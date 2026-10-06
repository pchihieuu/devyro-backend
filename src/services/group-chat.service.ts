import {
  GroupRole,
  GroupMember,
  MemberStatus,
} from "../entities/GroupMember.entity";
import { Group } from "../entities/Group.entity";
import { GroupMessage, MessageType } from "../entities/GroupMessage.entity";
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
import { publishGroupNotification } from "../workers/chat";
import { OUTBOX_TOPICS, outboxRelay } from "../workers/outbox-relay";
import { logger } from "../utils/logger";
import {
  GroupChatRepository,
  groupChatRepository,
} from "../repositories/group-chat.repository";
import {
  GroupMessageDTO,
  GroupSummaryDTO,
  GroupDetailDTO,
  PendingInvitationDTO,
  GroupMessagesResult,
  AddMembersResult,
  GroupMemberPreviewDTO,
  GroupMessagePayload,
} from "../types/group-chat.types";

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

/** Log lỗi của side-effect fire-and-forget với đủ context để grep theo group. */
const logSideEffectError =
  (scope: string, meta: Record<string, unknown> = {}) =>
  (err: unknown): void => {
    logger.error(`[group-chat] ${scope} failed`, {
      ...meta,
      error: err instanceof Error ? err.message : String(err),
    });
  };

export class GroupChatService {
  constructor(
    private readonly repo: GroupChatRepository = groupChatRepository
  ) {}

  // ─── Group creation / update ──────────────────────────────────────────────

  async createGroup(creatorId: string, data: CreateGroupData): Promise<Group> {
    const { name, description, memberIds } = data;

    if (!name?.trim()) throw new BadRequestError("Group name is required");

    const inviteeIds = [...new Set(memberIds.filter((id) => id !== creatorId))];

    const users = await this.repo.findUsersByIds([creatorId, ...inviteeIds]);
    const userMap = new Map(users.map((u) => [u.id, u]));
    if (!userMap.has(creatorId)) throw new BadRequestError("Creator not found");
    if (inviteeIds.some((id) => !userMap.has(id))) {
      throw new BadRequestError("One or more invited users not found");
    }

    const group = await this.repo.createGroupWithMembers({
      creatorId,
      name: name.trim(),
      description: description?.trim() || null,
      inviteeIds,
    });

    if (inviteeIds.length > 0) {
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
      }).catch(logSideEffectError("createGroup notify", { groupId: group.id }));
    }

    return group;
  }

  async updateGroup(
    requesterId: string,
    groupId: string,
    data: UpdateGroupData
  ): Promise<Group> {
    await this.assertAdmin(requesterId, groupId);

    const group = await this.repo.findGroupById(groupId);
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

    await this.repo.saveGroup(group);

    const activeMembers = await this.repo.findActiveMembers(groupId);

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
    }).catch(logSideEffectError("updateGroup notify", { groupId }));

    return (await this.repo.findGroupFull(groupId))!;
  }

  // ─── Invitation response ──────────────────────────────────────────────────

  async acceptInvitation(userId: string, groupId: string): Promise<void> {
    const membership = await this.repo.findMembership(userId, groupId);
    if (!membership) throw new NotFoundError("Invitation not found");

    // Chuyển trạng thái nguyên tử: request thứ 2 (double-click) nhận false.
    const activated = await this.repo.activatePendingMember(userId, groupId);
    if (!activated) throw new BadRequestError("Invitation already responded to");

    const [user, activeMembers, fullGroup] = await Promise.all([
      this.repo.findUserById(userId),
      this.repo.findActiveMembers(groupId),
      this.repo.findGroupFull(groupId),
    ]);

    publishGroupNotification({
      event: "group:member:joined",
      targetUserIds: activeMembers
        .map((m) => m.userId)
        .filter((id) => id !== userId),
      data: {
        groupId,
        user: { id: user!.id, name: user!.name, avatar: user!.avatar },
      },
    }).catch(logSideEffectError("acceptInvitation notify", { groupId }));

    try {
      getWebSocketService().sendToUser(userId, "group:joined", {
        group: fullGroup,
      });
    } catch (err) {
      logSideEffectError("acceptInvitation ws", { groupId, userId })(err);
    }
  }

  async rejectInvitation(userId: string, groupId: string): Promise<void> {
    const membership = await this.repo.findMembership(userId, groupId);
    if (!membership) throw new NotFoundError("Invitation not found");

    const rejected = await this.repo.rejectPendingMember(userId, groupId);
    if (!rejected) throw new BadRequestError("Invitation already responded to");

    const [admins, user] = await Promise.all([
      this.repo.findActiveAdmins(groupId),
      this.repo.findUserById(userId),
    ]);

    publishGroupNotification({
      event: "group:invitation:rejected",
      targetUserIds: admins.map((a) => a.userId),
      data: { groupId, user: { id: user!.id, name: user!.name } },
    }).catch(logSideEffectError("rejectInvitation notify", { groupId }));
  }

  async getPendingInvitations(userId: string): Promise<PendingInvitationDTO[]> {
    const memberships = await this.repo.findPendingInvitations(userId);

    return memberships.map((m) => ({
      groupId: m.groupId,
      groupName: m.group.name,
      groupAvatar: m.group.avatar,
      groupDescription: m.group.description,
      invitedBy: {
        id: m.invitedBy?.id ?? "",
        name: m.invitedBy?.name ?? "",
        avatar: m.invitedBy?.avatar ?? null,
      },
      invitedAt: m.invitedAt,
    }));
  }

  // ─── Groups list / details ────────────────────────────────────────────────

  /** @param search lọc theo tên group (không phân biệt hoa thường). */
  async getUserGroups(
    userId: string,
    search?: string
  ): Promise<GroupSummaryDTO[]> {
    const memberships = await this.repo.findActiveMembershipsWithGroups(
      userId,
      search
    );

    return memberships.map(({ group, unreadCount, lastReadAt, role }) => {
      // Repository đã chỉ join member ACTIVE.
      const activeMembers = group.members;

      /**
       * effectiveUnread: nếu lastReadAt >= lastMessageAt thì unread = 0 dù DB
       * chưa kịp reset (race khi reconnect nhanh).
       */
      const effectiveUnread =
        lastReadAt && group.lastMessageAt && lastReadAt >= group.lastMessageAt
          ? 0
          : unreadCount;

      return {
        id: group.id,
        name: group.name,
        description: group.description,
        avatar: group.avatar,
        lastMessage: group.lastMessage,
        lastMessageAt: group.lastMessageAt,
        lastMessageSenderId: group.lastMessageSenderId,
        unreadCount: effectiveUnread,
        role,
        memberCount: group.memberCount,
        members: activeMembers.map(
          (m): GroupMemberPreviewDTO => ({
            id: m.userId,
            name: m.user.name,
            avatar: m.user.avatar,
            email: m.user.email,
            role: m.role,
          })
        ),
        createdAt: group.createdAt,
      };
    });
  }

  async getGroupDetails(
    userId: string,
    groupId: string
  ): Promise<GroupDetailDTO> {
    await this.assertActiveMember(userId, groupId);

    const group = await this.repo.findGroupDetail(groupId);
    if (!group) throw new NotFoundError("Group not found");

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      avatar: group.avatar,
      createdBy: { id: group.createdBy.id, name: group.createdBy.name },
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

  // ─── Messages ─────────────────────────────────────────────────────────────

  /** @param search lọc theo nội dung tin nhắn (không phân biệt hoa thường). */
  async getGroupMessages(
    userId: string,
    groupId: string,
    page: number = 1,
    limit: number = 50,
    search?: string
  ): Promise<GroupMessagesResult> {
    await this.assertActiveMember(userId, groupId);

    const skip = (page - 1) * limit;
    const [messages, total] = await this.repo.findMessagesPage(
      groupId,
      skip,
      limit,
      search
    );

    return {
      messages: messages
        .reverse()
        .map((msg) => this.formatMessage(msg, userId)),
      total,
      hasMore: skip + messages.length < total,
    };
  }

  /**
   * Lưu tin + last_message/unread/seen + event outbox trong 1 transaction
   * (xem GroupChatRepository.createMessageWithEffects). Realtime KHÔNG còn
   * được publish trực tiếp từ request: relay (workers/outbox-relay) gửi event
   * đã commit ra RabbitMQ — process crash giữa "lưu DB" và "publish MQ" không
   * làm mất event, và lỗi MQ chỉ làm event được retry thay vì rớt âm thầm.
   * Giao hàng at-least-once → client dedupe theo `message.id`.
   */
  async sendGroupMessage(
    senderId: string,
    groupId: string,
    data: SendGroupMessageData
  ): Promise<GroupMessageDTO> {
    const membership = await this.repo.findActiveMembershipWithUser(
      senderId,
      groupId
    );
    if (!membership) {
      throw new ForbiddenError("You are not an active member of this group");
    }
    const sender = membership.user;

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

    const replyTo = replyToId
      ? await this.repo.findReplyTarget(groupId, replyToId)
      : null;
    if (replyToId && !replyTo) {
      throw new NotFoundError("Replied message not found");
    }

    let formatted!: GroupMessageDTO;

    await this.repo.createMessageWithEffects(
      {
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
      },
      type === MessageType.TEXT ? (content ?? null) : `[${type}]`,
      (message) => {
        formatted = {
          id: message.id,
          groupId,
          senderId,
          senderName: sender.name,
          senderAvatar: sender.avatar ?? null,
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
                // BUG FIX: trước đây luôn null → tin realtime/response của tin
                // reply không hiện tên người được trả lời cho tới khi reload.
                senderName: replyTo.sender?.name ?? null,
                isDeleted: replyTo.isDeleted,
              }
            : null,
          seenBy: [],
          seenByMe: true,
          isDeleted: false,
          createdAt: message.createdAt,
        };
        const payload: GroupMessagePayload = {
          groupId,
          message: formatted,
          senderUserId: senderId,
        };
        return { topic: OUTBOX_TOPICS.GROUP_MESSAGE_NEW, payload };
      }
    );

    // Giao event sớm (không chờ vòng poll). Lỗi ở đây không ảnh hưởng request:
    // event đã nằm trong outbox và sẽ được relay gửi lại.
    outboxRelay.kick();

    return formatted;
  }

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

  // ─── Seen / read receipts ─────────────────────────────────────────────────

  async markGroupAsRead(userId: string, groupId: string): Promise<void> {
    await this.assertActiveMember(userId, groupId);

    // unread=0 + lastReadAt + seen records cùng 1 transaction: nguồn sự thật
    // để getUserGroups tính effectiveUnread đúng sau reconnect/login lại.
    const senderIds = await this.repo.markAllSeen(userId, groupId);

    if (senderIds.length > 0) {
      publishGroupNotification({
        event: "group:messages:seen",
        targetUserIds: senderIds,
        data: { groupId, seenBy: userId, seenAt: new Date() },
      }).catch(logSideEffectError("markGroupAsRead notify", { groupId }));
    }
  }

  // ─── Member management ────────────────────────────────────────────────────

  async addMembers(
    requesterId: string,
    groupId: string,
    userIds: string[]
  ): Promise<AddMembersResult> {
    await this.assertAdmin(requesterId, groupId);

    const group = await this.repo.findGroupById(groupId);
    if (!group) throw new NotFoundError("Group not found");

    if (!userIds?.length) throw new BadRequestError("No user IDs provided");

    const uniqueIds = [...new Set(userIds)].filter((id) => id !== requesterId);
    if (!uniqueIds.length) return { invited: [], skipped: [] };

    const users = await this.repo.findUsersByIds(uniqueIds);
    if (users.length !== uniqueIds.length) {
      const foundIds = new Set(users.map((u) => u.id));
      const missing = uniqueIds.filter((id) => !foundIds.has(id));
      throw new BadRequestError(`Users not found: ${missing.join(", ")}`);
    }

    const existingMemberships = await this.repo.findMembershipsOfUsers(
      groupId,
      uniqueIds
    );
    const existingMap = new Map(existingMemberships.map((m) => [m.userId, m]));

    const toCreate: string[] = [];
    const toReinvite: GroupMember[] = [];
    const skipped: string[] = [];

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
        existing.respondedAt = null;
        toReinvite.push(existing);
      } else {
        skipped.push(userId);
      }
    }

    await Promise.all([
      this.repo.saveMemberships(
        toCreate.map((userId) =>
          this.repo.createMembership({
            groupId,
            userId,
            role: GroupRole.MEMBER,
            status: MemberStatus.PENDING,
            invitedAt: new Date(),
            invitedById: requesterId,
          })
        )
      ),
      this.repo.saveMemberships(toReinvite),
    ]);

    const allInvited = [...toCreate, ...toReinvite.map((m) => m.userId)];

    if (allInvited.length > 0) {
      const requester = await this.repo.findUserById(requesterId);

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
      }).catch(logSideEffectError("addMembers notify", { groupId }));
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

    const membership = await this.repo.findActiveMembership(
      targetUserId,
      groupId
    );
    if (!membership) throw new NotFoundError("Active member not found");

    if (membership.role === GroupRole.ADMIN) {
      const adminCount = await this.repo.countActiveAdmins(groupId);
      if (adminCount <= 1) {
        throw new BadRequestError(
          "Cannot remove the only admin. Promote another member first."
        );
      }
    }

    const removed = await this.repo.deactivateActiveMember(
      targetUserId,
      groupId,
      isSelf ? MemberStatus.LEFT : MemberStatus.KICKED
    );
    // Có request khác đã gỡ user này giữa lúc check và update.
    if (!removed) throw new NotFoundError("Active member not found");

    const remaining = await this.repo.findActiveMembers(groupId);

    publishGroupNotification({
      event: "group:member:removed",
      targetUserIds: [targetUserId, ...remaining.map((m) => m.userId)],
      data: { groupId, removedUserId: targetUserId, isSelf },
    }).catch(logSideEffectError("removeMember notify", { groupId }));
  }

  async promoteMember(
    requesterId: string,
    groupId: string,
    targetUserId: string
  ): Promise<void> {
    await this.assertAdmin(requesterId, groupId);

    const promoted = await this.repo.promoteToAdmin(targetUserId, groupId);
    if (!promoted) throw new NotFoundError("Active member not found in group");

    publishGroupNotification({
      event: "group:member:promoted",
      targetUserIds: [targetUserId],
      data: { groupId, promotedUserId: targetUserId },
    }).catch(logSideEffectError("promoteMember notify", { groupId }));
  }

  /**
   * Xoá mềm tin nhắn.
   *
   * BUG FIX: bản cũ đoán "tin bị xoá có phải tin cuối không" bằng cách so
   * senderId + timestamp với dung sai 2 giây → xoá một tin cũ của cùng người
   * gửi trong vòng 2s quanh tin cuối sẽ reset nhầm last_message. Giờ luôn đồng
   * bộ last_message với tin còn hiển thị mới nhất (idempotent, không đoán).
   */
  async deleteGroupMessage(
    userId: string,
    groupId: string,
    messageId: string
  ): Promise<void> {
    const membership = await this.assertActiveMember(userId, groupId);

    const message = await this.repo.findActiveMessage(groupId, messageId);
    if (!message) throw new NotFoundError("Message not found");

    if (message.senderId !== userId && membership.role !== GroupRole.ADMIN) {
      throw new ForbiddenError("Not authorized to delete this message");
    }

    await this.repo.markMessageDeleted(messageId);

    const previousMessage = await this.repo.findLatestVisibleMessage(groupId);
    await this.repo.setLastMessage(groupId, previousMessage);

    const activeMembers = await this.repo.findActiveMembers(groupId);

    const notifyDelete = () =>
      publishGroupNotification({
        event: "group:message:deleted",
        targetUserIds: activeMembers.map((m) => m.userId),
        data: {
          groupId,
          messageId,
          previousMessage: previousMessage
            ? {
                id: previousMessage.id,
                content: previousMessage.content,
                type: previousMessage.type,
                senderId: previousMessage.senderId,
                createdAt: previousMessage.createdAt,
              }
            : null,
        },
      }).catch(logSideEffectError("deleteGroupMessage notify", { groupId }));

    if (message.filePublicId) {
      const resourceType =
        message.type === MessageType.IMAGE
          ? "image"
          : message.type === MessageType.VIDEO
            ? "video"
            : "raw";
      await Promise.all([
        deleteChatMedia(message.filePublicId, resourceType),
        notifyDelete(),
      ]).catch(logSideEffectError("deleteGroupMessage media", { groupId }));
    } else {
      await notifyDelete();
    }
  }

  // ─── WebSocket sync on reconnect ──────────────────────────────────────────

  async syncOnReconnect(userId: string): Promise<void> {
    const [groups, pendingInvites] = await Promise.all([
      this.getUserGroups(userId),
      this.getPendingInvitations(userId),
    ]);

    try {
      getWebSocketService().sendToUser(userId, "sync:groups", {
        groups,
        pendingInvitations: pendingInvites,
        syncedAt: new Date(),
      });
    } catch (err) {
      logSideEffectError("syncOnReconnect", { userId })(err);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async assertActiveMember(
    userId: string,
    groupId: string
  ): Promise<GroupMember> {
    const membership = await this.repo.findActiveMembership(userId, groupId);
    if (!membership) {
      throw new ForbiddenError("You are not an active member of this group");
    }
    return membership;
  }

  private async assertAdmin(userId: string, groupId: string): Promise<void> {
    const membership = await this.assertActiveMember(userId, groupId);
    if (membership.role !== GroupRole.ADMIN) {
      throw new ForbiddenError("Only admins can perform this action");
    }
  }

  private formatMessage(
    msg: GroupMessage,
    currentUserId?: string
  ): GroupMessageDTO {
    return {
      id: msg.id,
      groupId: msg.groupId,
      senderId: msg.senderId,
      senderName: msg.sender?.name ?? "",
      senderAvatar: msg.sender?.avatar ?? null,
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
            senderName: msg.replyTo.sender?.name ?? null,
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
