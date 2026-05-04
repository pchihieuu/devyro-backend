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

      // ✅ Fire-and-forget — invitation không cần block response trả về group
      const creator = userMap.get(creatorId)!;
      publishGroupNotification({
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
      }).catch((err) =>
        console.error("[createGroup] publishGroupNotification error:", err)
      );
    }

    return (await this.groupRepo.findOne({
      where: { id: group.id },
      relations: ["members", "members.user", "createdBy"],
    }))!;
  }

  // Update Group

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

    // ✅ Fire-and-forget — UI update notification không cần block
    publishGroupNotification({
      event: "group:updated",
      targetUserIds: activeMembers.map((m) => m.userId),
      data: {
        groupId,
        name: group.name,
        description: group.description,
        avatar: group.avatar,
        updatedBy: requesterId,
      },
    }).catch((err) =>
      console.error("[updateGroup] publishGroupNotification error:", err)
    );

    return (await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ["members", "members.user", "createdBy"],
    }))!;
  }

  //  Invitation Response
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

    // Lấy song song user info + active members + full group data
    const [user, activeMembers, fullGroup] = await Promise.all([
      this.userRepo.findOne({ where: { id: userId } }),
      this.memberRepo.find({ where: { groupId, status: MemberStatus.ACTIVE } }),
      this.groupRepo.findOne({
        where: { id: groupId },
        relations: ["members", "members.user", "createdBy"],
      }),
    ]);

    // ✅ Fire-and-forget — "member joined" notification không cần block
    publishGroupNotification({
      event: "group:member:joined",
      targetUserIds: activeMembers
        .map((m) => m.userId)
        .filter((id) => id !== userId),
      data: {
        groupId,
        user: { id: user!.id, name: user!.name, avatar: user!.avatar },
      },
    }).catch((err) =>
      console.error("[acceptInvitation] publishGroupNotification error:", err)
    );

    // Send the full group data to the new member so they can render it
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

    // Lấy song song admins + user info
    const [admins, user] = await Promise.all([
      this.memberRepo.find({
        where: { groupId, role: GroupRole.ADMIN, status: MemberStatus.ACTIVE },
      }),
      this.userRepo.findOne({ where: { id: userId } }),
    ]);

    // ✅ Fire-and-forget — admin notification không cần block response
    publishGroupNotification({
      event: "group:invitation:rejected",
      targetUserIds: admins.map((a) => a.userId),
      data: {
        groupId,
        user: { id: user!.id, name: user!.name },
      },
    }).catch((err) =>
      console.error("[rejectInvitation] publishGroupNotification error:", err)
    );
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

    // ✅ Chạy song song: validate replyTo + lấy sender info
    const [replyTo, sender] = await Promise.all([
      replyToId
        ? this.messageRepo.findOne({
            where: { id: replyToId, groupId, isDeleted: false },
            select: ["id", "content", "senderId", "type", "isDeleted"],
          })
        : Promise.resolve(null),
      this.userRepo.findOne({
        where: { id: senderId },
        select: ["id", "name", "avatar"],
      }),
    ]);

    if (replyToId && !replyTo) {
      throw new NotFoundError("Replied message not found");
    }

    // Save message
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

    // ✅ Format ngay từ data đã có — không cần findOne với relations
    const formatted = {
      id: message.id,
      groupId,
      senderId,
      senderName: sender?.name ?? "",
      senderAvatar: sender?.avatar ?? null,
      content: content || null,
      type,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileSize: fileSize || null,
      fileMimeType: fileMimeType || null,
      replyTo: replyTo
        ? {
            id: replyTo.id,
            content: replyTo.content,
            senderId: replyTo.senderId,
            isDeleted: replyTo.isDeleted,
          }
        : null,
      seenBy: [],
      seenByMe: true,
      isDeleted: false,
      createdAt: message.createdAt,
    };

    // ✅ Deliver qua WebSocket NGAY — không chờ các side effects
    const wsService = getWebSocketService();
    wsService.sendToGroup(groupId, "group:message:new", {
      groupId,
      message: formatted,
    });

    // ✅ Chạy song song tất cả side effects — không block response
    Promise.all([
      // Update group preview
      this.groupRepo.update(groupId, {
        lastMessage: type === MessageType.TEXT ? content : `[${type}]`,
        lastMessageSenderId: senderId,
        lastMessageAt: new Date(),
      }),

      // Increment unread + mark seen cho sender — gộp vào 1 query
      this.incrementUnreadAndMarkSeen(senderId, groupId, message.id),

      // Fire-and-forget MQ publish (audit log, push notification, etc.)
      publishGroupMessage({
        groupId,
        message: formatted,
        senderUserId: senderId,
      }),
    ]).catch((err) => {
      console.error("[sendGroupMessage] side effects error:", err);
    });

    return formatted;
  }

  // ✅ Helper gộp unread increment + mark seen vào 1 DB roundtrip
  private async incrementUnreadAndMarkSeen(
    senderId: string,
    groupId: string,
    messageId: string
  ): Promise<void> {
    await Promise.all([
      // Bulk increment unread cho các member khác bằng 1 UPDATE query
      this.memberRepo
        .createQueryBuilder()
        .update(GroupMember)
        .set({ unreadCount: () => "unread_count + 1" })
        .where(
          "group_id = :groupId AND user_id != :senderId AND status = :status",
          { groupId, senderId, status: MemberStatus.ACTIVE }
        )
        .execute(),

      // Mark seen cho sender
      this.markMessageSeen(senderId, messageId, groupId),
    ]);
  }

  //  Upload Media

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

  //  Seen / Read Receipts

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

      // ✅ Fire-and-forget — seen notification không cần block
      publishGroupNotification({
        event: "group:messages:seen",
        targetUserIds: [
          ...new Set(unseenMessages.map((m) => m.senderId)),
        ].filter((id) => id !== userId),
        data: { groupId, seenBy: userId, seenAt: new Date() },
      }).catch((err) =>
        console.error("[markGroupAsRead] publishGroupNotification error:", err)
      );
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

  //  Member Management

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
        existing.status = MemberStatus.PENDING;
        existing.invitedAt = new Date();
        existing.invitedById = requesterId;
        existing.respondedAt = null as any;
        toReinvite.push(existing);
      } else {
        skipped.push(userId);
      }
    }

    // Persist new memberships + re-invites song song
    await Promise.all([
      toCreate.length > 0
        ? this.memberRepo.save(
            toCreate.map((userId) =>
              this.memberRepo.create({
                groupId,
                userId,
                role: GroupRole.MEMBER,
                status: MemberStatus.PENDING,
                invitedAt: new Date(),
                invitedById: requesterId,
              })
            )
          )
        : Promise.resolve(),
      toReinvite.length > 0
        ? this.memberRepo.save(toReinvite)
        : Promise.resolve(),
    ]);

    const allInvited = [...toCreate, ...toReinvite.map((m) => m.userId)];

    if (allInvited.length > 0) {
      const requester = await this.userRepo.findOne({
        where: { id: requesterId },
      });

      // ✅ Fire-and-forget — invitation notify không cần block API response
      publishGroupNotification({
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
      }).catch((err) =>
        console.error("[addMembers] publishGroupNotification error:", err)
      );
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

    // ✅ Fire-and-forget — member removed notify không cần block
    publishGroupNotification({
      event: "group:member:removed",
      targetUserIds: [targetUserId, ...remaining.map((m) => m.userId)],
      data: { groupId, removedUserId: targetUserId, isSelf },
    }).catch((err) =>
      console.error("[removeMember] publishGroupNotification error:", err)
    );
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

    // ✅ Fire-and-forget — promote notify không cần block
    publishGroupNotification({
      event: "group:member:promoted",
      targetUserIds: [targetUserId],
      data: { groupId, promotedUserId: targetUserId },
    }).catch((err) =>
      console.error("[promoteMember] publishGroupNotification error:", err)
    );
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

    // Delete from Cloudinary if media — không cần block notify
    if (message.filePublicId) {
      const rt =
        message.type === MessageType.IMAGE
          ? "image"
          : message.type === MessageType.VIDEO
            ? "video"
            : "raw";
      // ✅ Fire-and-forget cloudinary delete + notification song song
      Promise.all([
        deleteChatMedia(message.filePublicId, rt as any),
        this.memberRepo
          .find({ where: { groupId, status: MemberStatus.ACTIVE } })
          .then((activeMembers) =>
            publishGroupNotification({
              event: "group:message:deleted",
              targetUserIds: activeMembers.map((m) => m.userId),
              data: { groupId, messageId },
            })
          ),
      ]).catch((err) =>
        console.error("[deleteGroupMessage] side effects error:", err)
      );
    } else {
      // Không có media — chỉ notify
      this.memberRepo
        .find({ where: { groupId, status: MemberStatus.ACTIVE } })
        .then((activeMembers) =>
          // ✅ Fire-and-forget
          publishGroupNotification({
            event: "group:message:deleted",
            targetUserIds: activeMembers.map((m) => m.userId),
            data: { groupId, messageId },
          })
        )
        .catch((err) =>
          console.error(
            "[deleteGroupMessage] publishGroupNotification error:",
            err
          )
        );
    }
  }

  //  WebSocket Sync on Reconnect

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
      console.error("[syncOnReconnect] error:", err);
    }
  }

  //  Helpers

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
