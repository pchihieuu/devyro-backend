import { AppDataSource } from "../config/database.config";
import { Group } from "../entities/Group.entity";
import {
  GroupMember,
  GroupRole,
  MemberStatus,
} from "../entities/GroupMember.entity";
import { GroupMessage, MessageType } from "../entities/GroupMessage.entity";
import { GroupMessageSeen } from "../entities/GroupMessageSeen.entity";
import { User } from "../entities/User.entity";
import { getWebSocketService } from "./websocket.service";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../utils/errors";

import {
  deleteChatMedia,
  uploadChatMedia,
  UploadedMedia,
} from "../utils/chat-media.util";
import { publishGroupMessage, publishGroupNotification } from "../workers/chat";

interface CreateGroupData {
  name: string;
  description?: string;
  memberIds: string[];
}
interface UpdateGroupData {
  name?: string;
  description?: string;
  avatar?: string;
}

interface SendGroupMessageData {
  content?: string;
  type?: MessageType;
  fileUrl?: string;
  filePublicId?: string;
  fileName?: string;
  fileSize?: number;
  fileMimeType?: string;
  replyToId?: string;
}

export class GroupChatService {
  private groupRepo = AppDataSource.getRepository(Group);
  private memberRepo = AppDataSource.getRepository(GroupMember);
  private messageRepo = AppDataSource.getRepository(GroupMessage);
  private seenRepo = AppDataSource.getRepository(GroupMessageSeen);
  private userRepo = AppDataSource.getRepository(User);

  // Group Creation

  /**
   * Create group. Creator is immediately ACTIVE+ADMIN.
   * All other members get PENDING invitations (real-time notification sent).
   */
  async createGroup(creatorId: string, data: CreateGroupData): Promise<Group> {
    const { name, description, memberIds } = data;

    if (!name?.trim()) throw new BadRequestError("Group name is required");

    const inviteeIds = [...new Set(memberIds.filter((id) => id !== creatorId))];

    // Validate all users exist
    const allIds = [creatorId, ...inviteeIds];
    const users = await this.userRepo.findByIds(allIds);
    const userMap = new Map(users.map((u) => [u.id, u]));
    if (!userMap.has(creatorId)) throw new BadRequestError("Creator not found");
    if (inviteeIds.some((id) => !userMap.has(id))) {
      throw new BadRequestError("One or more invited users not found");
    }

    // Create group
    const group = this.groupRepo.create({
      name: name.trim(),
      description: description?.trim() || null,
      createdById: creatorId,
    });
    await this.groupRepo.save(group);

    // Creator → ACTIVE + ADMIN immediately
    const creatorMember = this.memberRepo.create({
      groupId: group.id,
      userId: creatorId,
      role: GroupRole.ADMIN,
      status: MemberStatus.ACTIVE,
      invitedAt: new Date(),
      invitedById: creatorId,
      respondedAt: new Date(),
    });
    await this.memberRepo.save(creatorMember);

    // Invitees → PENDING
    if (inviteeIds.length > 0) {
      const pendingMembers = inviteeIds.map((userId) =>
        this.memberRepo.create({
          groupId: group.id,
          userId,
          role: GroupRole.MEMBER,
          status: MemberStatus.PENDING,
          invitedAt: new Date(),
          invitedById: creatorId,
        })
      );
      await this.memberRepo.save(pendingMembers);

      // Send invitations via MQ → WS
      const creator = userMap.get(creatorId)!;
      await publishGroupNotification({
        event: "group:invitation",
        targetUserIds: inviteeIds,
        data: {
          groupId: group.id,
          groupName: group.name,
          invitedBy: {
            id: creator.id,
            name: creator.name,
            avatar: creator.avatar,
          },
          actions: { accept: true, reject: true },
        },
      });
    }

    return (await this.groupRepo.findOne({
      where: { id: group.id },
      relations: ["members", "members.user", "createdBy"],
    }))!;
  }

  /**
   * Cập nhật thông tin group (tên, mô tả, avatar).
   * Chỉ ADMIN mới được thực hiện.
   */
  async updateGroup(
    requesterId: string,
    groupId: string,
    data: UpdateGroupData
  ): Promise<Group> {
    await this.assertAdmin(requesterId, groupId);

    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundError("Group not found");

    if (data.name !== undefined) {
      if (!data.name.trim())
        throw new BadRequestError("Group name cannot be empty");
      group.name = data.name.trim();
    }
    if (data.description !== undefined) {
      group.description = data.description?.trim() || null;
    }
    if (data.avatar !== undefined) {
      group.avatar = data.avatar || null;
    }

    await this.groupRepo.save(group);

    // Notify tất cả ACTIVE members về thay đổi
    const activeMembers = await this.memberRepo.find({
      where: { groupId, status: MemberStatus.ACTIVE },
    });

    await publishGroupNotification({
      event: "group:updated",
      targetUserIds: activeMembers.map((m) => m.userId),
      data: {
        groupId,
        name: group.name,
        description: group.description,
        avatar: group.avatar,
        updatedBy: requesterId,
      },
    });

    return (await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ["members", "members.user", "createdBy"],
    }))!;
  }
  // Invitation Response
  /**
   * User accepts a group invitation → status: ACTIVE
   */
  async acceptInvitation(userId: string, groupId: string): Promise<void> {
    const membership = await this.memberRepo.findOne({
      where: { userId, groupId },
    });

    if (!membership) throw new NotFoundError("Invitation not found");
    if (membership.status !== MemberStatus.PENDING) {
      throw new BadRequestError("Invitation already responded to");
    }

    membership.status = MemberStatus.ACTIVE;
    membership.respondedAt = new Date();
    await this.memberRepo.save(membership);

    // Notify all ACTIVE members that someone joined
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const activeMembers = await this.memberRepo.find({
      where: { groupId, status: MemberStatus.ACTIVE },
    });

    await publishGroupNotification({
      event: "group:member:joined",
      targetUserIds: activeMembers
        .map((m) => m.userId)
        .filter((id) => id !== userId),
      data: {
        groupId,
        user: { id: user!.id, name: user!.name, avatar: user!.avatar },
      },
    });

    // Send the full group data to the new member so they can render it
    const fullGroup = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ["members", "members.user", "createdBy"],
    });

    try {
      const wsService = getWebSocketService();
      wsService.sendToUser(userId, "group:joined", { group: fullGroup });
    } catch {}
  }

  /**
   * User rejects a group invitation → status: REJECTED
   */
  async rejectInvitation(userId: string, groupId: string): Promise<void> {
    const membership = await this.memberRepo.findOne({
      where: { userId, groupId },
    });

    if (!membership) throw new NotFoundError("Invitation not found");
    if (membership.status !== MemberStatus.PENDING) {
      throw new BadRequestError("Invitation already responded to");
    }

    membership.status = MemberStatus.REJECTED;
    membership.respondedAt = new Date();
    await this.memberRepo.save(membership);

    // Notify group admins
    const admins = await this.memberRepo.find({
      where: { groupId, role: GroupRole.ADMIN, status: MemberStatus.ACTIVE },
    });
    const user = await this.userRepo.findOne({ where: { id: userId } });

    await publishGroupNotification({
      event: "group:invitation:rejected",
      targetUserIds: admins.map((a) => a.userId),
      data: {
        groupId,
        user: { id: user!.id, name: user!.name },
      },
    });
  }

  // Pending Invitations

  async getPendingInvitations(userId: string): Promise<any[]> {
    const memberships = await this.memberRepo.find({
      where: { userId, status: MemberStatus.PENDING },
      relations: ["group", "group.createdBy", "invitedBy"],
    });

    return memberships.map((m) => ({
      groupId: m.groupId,
      groupName: m.group.name,
      groupAvatar: m.group.avatar,
      groupDescription: m.group.description,
      invitedBy: {
        id: m.invitedBy?.id,
        name: m.invitedBy?.name,
        avatar: m.invitedBy?.avatar,
      },
      invitedAt: m.invitedAt,
    }));
  }

  // Groups List

  /**
   * Get all groups where user is ACTIVE
   */
  async getUserGroups(userId: string): Promise<any[]> {
    const memberships = await this.memberRepo.find({
      where: { userId, status: MemberStatus.ACTIVE },
      relations: ["group", "group.members", "group.members.user"],
      order: { group: { lastMessageAt: "DESC" } },
    });

    return memberships.map(({ group, unreadCount, role }) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      avatar: group.avatar,
      lastMessage: group.lastMessage,
      lastMessageAt: group.lastMessageAt,
      lastMessageSenderId: group.lastMessageSenderId,
      unreadCount,
      role,
      memberCount: group.members.filter((m) => m.status === MemberStatus.ACTIVE)
        .length,
      members: group.members
        .filter((m) => m.status === MemberStatus.ACTIVE)
        .map((m) => ({
          id: m.userId,
          name: m.user.name,
          avatar: m.user.avatar,
          email: m.user.email,
          role: m.role,
        })),
      createdAt: group.createdAt,
    }));
  }

  // Group Details

  async getGroupDetails(userId: string, groupId: string): Promise<any> {
    await this.assertActiveMember(userId, groupId);

    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ["members", "members.user", "members.invitedBy", "createdBy"],
    });
    if (!group) throw new NotFoundError("Group not found");

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      avatar: group.avatar,
      createdBy: {
        id: group.createdBy.id,
        name: group.createdBy.name,
      },
      members: group.members.map((m) => ({
        id: m.userId,
        name: m.user.name,
        avatar: m.user.avatar,
        email: m.user.email,
        role: m.role,
        status: m.status,
        joinedAt: m.respondedAt,
        invitedBy: m.invitedBy
          ? { id: m.invitedBy.id, name: m.invitedBy.name }
          : null,
      })),
      createdAt: group.createdAt,
    };
  }

  // Messages
  async getGroupMessages(
    userId: string,
    groupId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ messages: any[]; total: number; hasMore: boolean }> {
    await this.assertActiveMember(userId, groupId);

    const skip = (page - 1) * limit;

    const [messages, total] = await this.messageRepo.findAndCount({
      where: { groupId, isDeleted: false },
      relations: ["sender", "replyTo", "replyTo.sender", "seenBy"],
      order: { createdAt: "DESC" },
      take: limit,
      skip,
    });

    return {
      messages: messages
        .reverse()
        .map((msg) => this.formatMessage(msg, userId)),
      total,
      hasMore: skip + messages.length < total,
    };
  }

  async sendGroupMessage(
    senderId: string,
    groupId: string,
    data: SendGroupMessageData
  ): Promise<any> {
    await this.assertActiveMember(senderId, groupId);

    const {
      content,
      type = MessageType.TEXT,
      fileUrl,
      filePublicId,
      fileName,
      fileSize,
      fileMimeType,
      replyToId,
    } = data;

    if (type === MessageType.TEXT && !content?.trim()) {
      throw new BadRequestError(
        "Message content is required for text messages"
      );
    }
    if (type !== MessageType.TEXT && !fileUrl) {
      throw new BadRequestError("fileUrl is required for media messages");
    }

    if (replyToId) {
      const target = await this.messageRepo.findOne({
        where: { id: replyToId, groupId, isDeleted: false },
      });
      if (!target) throw new NotFoundError("Replied message not found");
    }

    const message = this.messageRepo.create({
      groupId,
      senderId,
      content: content || null,
      type,
      fileUrl: fileUrl || null,
      filePublicId: filePublicId || null,
      fileName: fileName || null,
      fileSize: fileSize || null,
      fileMimeType: fileMimeType || null,
      replyToId: replyToId || null,
    });
    await this.messageRepo.save(message);

    const fullMessage = await this.messageRepo.findOne({
      where: { id: message.id },
      relations: ["sender", "replyTo", "replyTo.sender", "seenBy"],
    });

    const formatted = this.formatMessage(fullMessage!, senderId);

    // Update group last message preview
    await this.groupRepo.update(groupId, {
      lastMessage: type === MessageType.TEXT ? content : `[${type}]`,
      lastMessageSenderId: senderId,
      lastMessageAt: new Date(),
    });

    // Increment unread for all ACTIVE members (except sender)
    const activeMembers = await this.memberRepo.find({
      where: { groupId, status: MemberStatus.ACTIVE },
    });

    const otherActive = activeMembers.filter((m) => m.userId !== senderId);
    for (const m of otherActive) m.unreadCount++;
    if (otherActive.length > 0) await this.memberRepo.save(otherActive);

    // Sender auto-marks message as seen
    await this.markMessageSeen(senderId, message.id, groupId);

    // Publish to MQ → workers will deliver via WS to ACTIVE members only
    await publishGroupMessage({
      groupId,
      message: formatted,
      senderUserId: senderId,
    });

    return formatted;
  }

  // Upload Media

  async uploadGroupMedia(
    userId: string,
    groupId: string,
    buffer: Buffer,
    mimeType: string,
    originalName: string,
    fileSize: number
  ): Promise<UploadedMedia> {
    await this.assertActiveMember(userId, groupId);
    return uploadChatMedia(buffer, mimeType, originalName, fileSize);
  }

  // Seen / Read Receipts

  async markGroupAsRead(userId: string, groupId: string): Promise<void> {
    await this.assertActiveMember(userId, groupId);

    // Reset unread count
    await this.memberRepo.update(
      { userId, groupId },
      { unreadCount: 0, lastReadAt: new Date() }
    );

    // Mark all unseen messages as seen
    const unseenMessages = await this.messageRepo
      .createQueryBuilder("msg")
      .leftJoin(
        "group_message_seen",
        "seen",
        "seen.messageId = msg.id AND seen.userId = :userId",
        { userId }
      )
      .where("msg.groupId = :groupId", { groupId })
      .andWhere("msg.senderId != :userId", { userId })
      .andWhere("msg.isDeleted = false")
      .andWhere("seen.id IS NULL")
      .getMany();

    if (unseenMessages.length > 0) {
      const seenRecords = unseenMessages.map((msg) =>
        this.seenRepo.create({ messageId: msg.id, userId, groupId })
      );
      await this.seenRepo.save(seenRecords);

      // Notify others about seen status
      await publishGroupNotification({
        event: "group:messages:seen",
        targetUserIds: [
          ...new Set(unseenMessages.map((m) => m.senderId)),
        ].filter((id) => id !== userId),
        data: { groupId, seenBy: userId, seenAt: new Date() },
      });
    }
  }

  private async markMessageSeen(
    userId: string,
    messageId: string,
    groupId: string
  ): Promise<void> {
    const exists = await this.seenRepo.findOne({
      where: { messageId, userId },
    });
    if (!exists) {
      await this.seenRepo.save(
        this.seenRepo.create({ messageId, userId, groupId })
      );
    }
  }

  // Member Management

  async addMembers(
    requesterId: string,
    groupId: string,
    userIds: string[]
  ): Promise<{ invited: string[]; skipped: string[] }> {
    await this.assertAdmin(requesterId, groupId);

    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundError("Group not found");

    if (!userIds?.length) throw new BadRequestError("No user IDs provided");

    const uniqueIds = [...new Set(userIds)].filter((id) => id !== requesterId);
    if (!uniqueIds.length) {
      return { invited: [], skipped: [] };
    }

    const users = await this.userRepo.findByIds(uniqueIds);
    if (users.length !== uniqueIds.length) {
      const foundIds = new Set(users.map((u) => u.id));
      const missing = uniqueIds.filter((id) => !foundIds.has(id));
      throw new BadRequestError(`Users not found: ${missing.join(", ")}`);
    }

    // Fetch ALL existing memberships for these users in this group,
    // regardless of status (ACTIVE, PENDING, KICKED, LEFT, REJECTED)
    const existingMemberships = await this.memberRepo.find({
      where: uniqueIds.map((userId) => ({ groupId, userId })),
    });
    const existingMap = new Map(existingMemberships.map((m) => [m.userId, m]));

    const toCreate: string[] = []; // No record at all → INSERT
    const toReinvite: GroupMember[] = []; // KICKED/LEFT/REJECTED → UPDATE to PENDING
    const skipped: string[] = []; // ACTIVE or already PENDING → skip

    for (const userId of uniqueIds) {
      const existing = existingMap.get(userId);

      if (!existing) {
        toCreate.push(userId);
      } else if (
        existing.status === MemberStatus.KICKED ||
        existing.status === MemberStatus.LEFT ||
        existing.status === MemberStatus.REJECTED
      ) {
        // Re-invite: reset membership to PENDING
        existing.status = MemberStatus.PENDING;
        existing.invitedAt = new Date();
        existing.invitedById = requesterId;
        existing.respondedAt = null as any;
        toReinvite.push(existing);
      } else {
        // ACTIVE or PENDING → already in group or already has pending invite
        skipped.push(userId);
      }
    }

    // Persist new memberships
    if (toCreate.length > 0) {
      const newMembers = toCreate.map((userId) =>
        this.memberRepo.create({
          groupId,
          userId,
          role: GroupRole.MEMBER,
          status: MemberStatus.PENDING,
          invitedAt: new Date(),
          invitedById: requesterId,
        })
      );
      await this.memberRepo.save(newMembers);
    }

    // Persist re-invites
    if (toReinvite.length > 0) {
      await this.memberRepo.save(toReinvite);
    }

    const allInvited = [...toCreate, ...toReinvite.map((m) => m.userId)];

    // Only send WS notification if there's actually someone to notify
    if (allInvited.length > 0) {
      const requester = await this.userRepo.findOne({
        where: { id: requesterId },
      });

      await publishGroupNotification({
        event: "group:invitation",
        targetUserIds: allInvited,
        data: {
          groupId,
          groupName: group.name,
          invitedBy: {
            id: requester!.id,
            name: requester!.name,
            avatar: requester!.avatar,
          },
          actions: { accept: true, reject: true },
        },
      });
    }

    return { invited: allInvited, skipped };
  }

  async removeMember(
    requesterId: string,
    groupId: string,
    targetUserId: string
  ): Promise<void> {
    const isSelf = requesterId === targetUserId;
    if (!isSelf) await this.assertAdmin(requesterId, groupId);

    const membership = await this.memberRepo.findOne({
      where: { groupId, userId: targetUserId, status: MemberStatus.ACTIVE },
    });
    if (!membership) throw new NotFoundError("Active member not found");

    if (membership.role === GroupRole.ADMIN) {
      const adminCount = await this.memberRepo.count({
        where: { groupId, role: GroupRole.ADMIN, status: MemberStatus.ACTIVE },
      });
      if (adminCount <= 1) {
        throw new BadRequestError(
          "Cannot remove the only admin. Promote another member first."
        );
      }
    }

    membership.status = isSelf ? MemberStatus.LEFT : MemberStatus.KICKED;
    await this.memberRepo.save(membership);

    const remaining = await this.memberRepo.find({
      where: { groupId, status: MemberStatus.ACTIVE },
    });

    await publishGroupNotification({
      event: "group:member:removed",
      targetUserIds: [targetUserId, ...remaining.map((m) => m.userId)],
      data: { groupId, removedUserId: targetUserId, isSelf },
    });
  }

  async promoteMember(
    requesterId: string,
    groupId: string,
    targetUserId: string
  ): Promise<void> {
    await this.assertAdmin(requesterId, groupId);

    const membership = await this.memberRepo.findOne({
      where: { groupId, userId: targetUserId, status: MemberStatus.ACTIVE },
    });
    if (!membership)
      throw new NotFoundError("Active member not found in group");

    membership.role = GroupRole.ADMIN;
    await this.memberRepo.save(membership);

    await publishGroupNotification({
      event: "group:member:promoted",
      targetUserIds: [targetUserId],
      data: { groupId, promotedUserId: targetUserId },
    });
  }

  async deleteGroupMessage(
    userId: string,
    groupId: string,
    messageId: string
  ): Promise<void> {
    await this.assertActiveMember(userId, groupId);

    const message = await this.messageRepo.findOne({
      where: { id: messageId, groupId, isDeleted: false },
    });
    if (!message) throw new NotFoundError("Message not found");

    const membership = await this.memberRepo.findOne({
      where: { userId, groupId },
    });
    if (message.senderId !== userId && membership?.role !== GroupRole.ADMIN) {
      throw new ForbiddenError("Not authorized to delete this message");
    }

    // Soft delete (keeps reply chains intact)
    message.isDeleted = true;
    await this.messageRepo.save(message);

    // Delete from Cloudinary if media
    if (message.filePublicId) {
      const rt =
        message.type === MessageType.IMAGE
          ? "image"
          : message.type === MessageType.VIDEO
            ? "video"
            : "raw";
      await deleteChatMedia(message.filePublicId, rt as any);
    }

    const activeMembers = await this.memberRepo.find({
      where: { groupId, status: MemberStatus.ACTIVE },
    });

    await publishGroupNotification({
      event: "group:message:deleted",
      targetUserIds: activeMembers.map((m) => m.userId),
      data: { groupId, messageId },
    });
  }

  // WebSocket Sync on Reconnect

  /**
   * Called when a user reconnects via WS. Sends them their current group state:
   * - Updated unread counts
   * - Last messages
   * - Pending invitations
   */
  async syncOnReconnect(userId: string): Promise<void> {
    const [groups, pendingInvites] = await Promise.all([
      this.getUserGroups(userId),
      this.getPendingInvitations(userId),
    ]);

    try {
      const wsService = getWebSocketService();
      wsService.sendToUser(userId, "sync:groups", {
        groups,
        pendingInvitations: pendingInvites,
        syncedAt: new Date(),
      });
    } catch (err) {
      console.error("syncOnReconnect error:", err);
    }
  }

  // Helpers

  private async assertActiveMember(
    userId: string,
    groupId: string
  ): Promise<GroupMember> {
    const membership = await this.memberRepo.findOne({
      where: { userId, groupId, status: MemberStatus.ACTIVE },
    });
    if (!membership)
      throw new ForbiddenError("You are not an active member of this group");
    return membership;
  }

  private async assertAdmin(userId: string, groupId: string): Promise<void> {
    const membership = await this.assertActiveMember(userId, groupId);
    if (membership.role !== GroupRole.ADMIN) {
      throw new ForbiddenError("Only admins can perform this action");
    }
  }

  private formatMessage(msg: GroupMessage, currentUserId?: string): any {
    return {
      id: msg.id,
      groupId: msg.groupId,
      senderId: msg.senderId,
      senderName: msg.sender?.name || null,
      senderAvatar: msg.sender?.avatar || null,
      content: msg.isDeleted ? null : msg.content,
      isDeleted: msg.isDeleted,
      type: msg.type,
      fileUrl: msg.isDeleted ? null : msg.fileUrl,
      fileName: msg.isDeleted ? null : msg.fileName,
      fileSize: msg.fileSize,
      fileMimeType: msg.fileMimeType,
      replyTo: msg.replyTo
        ? {
            id: msg.replyTo.id,
            content: msg.replyTo.isDeleted ? null : msg.replyTo.content,
            senderId: msg.replyTo.senderId,
            senderName: msg.replyTo.sender?.name || null,
            isDeleted: msg.replyTo.isDeleted,
          }
        : null,
      seenBy: (msg.seenBy || []).map((s) => ({
        userId: s.userId,
        seenAt: s.seenAt,
      })),
      seenByMe: currentUserId
        ? (msg.seenBy || []).some((s) => s.userId === currentUserId)
        : false,
      createdAt: msg.createdAt,
    };
  }
}

export const groupChatService = new GroupChatService();
