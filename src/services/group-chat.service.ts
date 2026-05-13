// import { AppDataSource } from "../config/database.config";
// import { Group } from "../entities/Group.entity";
// import {
//   GroupMember,
//   GroupRole,
//   MemberStatus,
// } from "../entities/GroupMember.entity";
// import { GroupMessage, MessageType } from "../entities/GroupMessage.entity";
// import { GroupMessageSeen } from "../entities/GroupMessageSeen.entity";
// import { User } from "../entities/User.entity";
// import { getWebSocketService } from "./websocket.service";
// import {
//   NotFoundError,
//   BadRequestError,
//   ForbiddenError,
// } from "../utils/errors";
// import {
//   deleteChatMedia,
//   uploadChatMedia,
//   UploadedMedia,
// } from "../utils/chat-media.util";
// import { publishGroupMessage, publishGroupNotification } from "../workers/chat";
// import {
//   GroupMessageDTO,
//   GroupSummaryDTO,
//   GroupDetailDTO,
//   PendingInvitationDTO,
//   GroupMessagesResult,
//   AddMembersResult,
//   GroupMemberPreviewDTO,
// } from "../types/group-chat.types";

// interface CreateGroupData {
//   name: string;
//   description?: string;
//   memberIds: string[];
// }

// interface UpdateGroupData {
//   name?: string;
//   description?: string;
//   avatar?: string;
// }

// interface SendGroupMessageData {
//   content?: string;
//   type?: MessageType;
//   fileUrl?: string;
//   filePublicId?: string;
//   fileName?: string;
//   fileSize?: number;
//   fileMimeType?: string;
//   replyToId?: string;
// }

// export class GroupChatService {
//   private groupRepo = AppDataSource.getRepository(Group);
//   private memberRepo = AppDataSource.getRepository(GroupMember);
//   private messageRepo = AppDataSource.getRepository(GroupMessage);
//   private seenRepo = AppDataSource.getRepository(GroupMessageSeen);
//   private userRepo = AppDataSource.getRepository(User);

//   // Group Creation

//   async createGroup(creatorId: string, data: CreateGroupData): Promise<Group> {
//     const { name, description, memberIds } = data;

//     if (!name?.trim()) throw new BadRequestError("Group name is required");

//     const inviteeIds = [...new Set(memberIds.filter((id) => id !== creatorId))];

//     const allIds = [creatorId, ...inviteeIds];
//     const users = await this.userRepo.findByIds(allIds);
//     const userMap = new Map(users.map((u) => [u.id, u]));
//     if (!userMap.has(creatorId)) throw new BadRequestError("Creator not found");
//     if (inviteeIds.some((id) => !userMap.has(id))) {
//       throw new BadRequestError("One or more invited users not found");
//     }

//     const group = this.groupRepo.create({
//       name: name.trim(),
//       description: description?.trim() || null,
//       createdById: creatorId,
//       memberCount: 1,
//     });
//     await this.groupRepo.save(group);

//     const creatorMember = this.memberRepo.create({
//       groupId: group.id,
//       userId: creatorId,
//       role: GroupRole.ADMIN,
//       status: MemberStatus.ACTIVE,
//       invitedAt: new Date(),
//       invitedById: creatorId,
//       respondedAt: new Date(),
//     });
//     await this.memberRepo.save(creatorMember);

//     if (inviteeIds.length > 0) {
//       const pendingMembers = inviteeIds.map((userId) =>
//         this.memberRepo.create({
//           groupId: group.id,
//           userId,
//           role: GroupRole.MEMBER,
//           status: MemberStatus.PENDING,
//           invitedAt: new Date(),
//           invitedById: creatorId,
//         })
//       );
//       await this.memberRepo.save(pendingMembers);

//       const creator = userMap.get(creatorId)!;
//       publishGroupNotification({
//         event: "group:invitation",
//         targetUserIds: inviteeIds,
//         data: {
//           groupId: group.id,
//           groupName: group.name,
//           invitedBy: {
//             id: creator.id,
//             name: creator.name,
//             avatar: creator.avatar,
//           },
//           actions: { accept: true, reject: true },
//         },
//       }).catch((err) =>
//         console.error("[createGroup] publishGroupNotification error:", err)
//       );
//     }

//     return (await this.groupRepo.findOne({
//       where: { id: group.id },
//       relations: ["members", "members.user", "createdBy"],
//     }))!;
//   }

//   // Update Group

//   async updateGroup(
//     requesterId: string,
//     groupId: string,
//     data: UpdateGroupData
//   ): Promise<Group> {
//     await this.assertAdmin(requesterId, groupId);

//     const group = await this.groupRepo.findOne({ where: { id: groupId } });
//     if (!group) throw new NotFoundError("Group not found");

//     if (data.name !== undefined) {
//       if (!data.name.trim())
//         throw new BadRequestError("Group name cannot be empty");
//       group.name = data.name.trim();
//     }
//     if (data.description !== undefined) {
//       group.description = data.description?.trim() || null;
//     }
//     if (data.avatar !== undefined) {
//       group.avatar = data.avatar || null;
//     }

//     await this.groupRepo.save(group);

//     const activeMembers = await this.memberRepo.find({
//       where: { groupId, status: MemberStatus.ACTIVE },
//     });

//     publishGroupNotification({
//       event: "group:updated",
//       targetUserIds: activeMembers.map((m) => m.userId),
//       data: {
//         groupId,
//         name: group.name,
//         description: group.description,
//         avatar: group.avatar,
//         updatedBy: requesterId,
//       },
//     }).catch((err) =>
//       console.error("[updateGroup] publishGroupNotification error:", err)
//     );

//     return (await this.groupRepo.findOne({
//       where: { id: groupId },
//       relations: ["members", "members.user", "createdBy"],
//     }))!;
//   }

//   // Invitation Response

//   async acceptInvitation(userId: string, groupId: string): Promise<void> {
//     const membership = await this.memberRepo.findOne({
//       where: { userId, groupId },
//     });

//     if (!membership) throw new NotFoundError("Invitation not found");
//     if (membership.status !== MemberStatus.PENDING) {
//       throw new BadRequestError("Invitation already responded to");
//     }

//     membership.status = MemberStatus.ACTIVE;
//     membership.respondedAt = new Date();
//     await this.memberRepo.save(membership);

//     await this.groupRepo
//       .createQueryBuilder()
//       .update(Group)
//       .set({ memberCount: () => "member_count + 1" })
//       .where("id = :groupId", { groupId })
//       .execute();

//     const [user, activeMembers, fullGroup] = await Promise.all([
//       this.userRepo.findOne({ where: { id: userId } }),
//       this.memberRepo.find({ where: { groupId, status: MemberStatus.ACTIVE } }),
//       this.groupRepo.findOne({
//         where: { id: groupId },
//         relations: ["members", "members.user", "createdBy"],
//       }),
//     ]);

//     publishGroupNotification({
//       event: "group:member:joined",
//       targetUserIds: activeMembers
//         .map((m) => m.userId)
//         .filter((id) => id !== userId),
//       data: {
//         groupId,
//         user: { id: user!.id, name: user!.name, avatar: user!.avatar },
//       },
//     }).catch((err) =>
//       console.error("[acceptInvitation] publishGroupNotification error:", err)
//     );

//     try {
//       const wsService = getWebSocketService();
//       wsService.sendToUser(userId, "group:joined", { group: fullGroup });
//     } catch {}
//   }

//   async rejectInvitation(userId: string, groupId: string): Promise<void> {
//     const membership = await this.memberRepo.findOne({
//       where: { userId, groupId },
//     });

//     if (!membership) throw new NotFoundError("Invitation not found");
//     if (membership.status !== MemberStatus.PENDING) {
//       throw new BadRequestError("Invitation already responded to");
//     }

//     membership.status = MemberStatus.REJECTED;
//     membership.respondedAt = new Date();
//     await this.memberRepo.save(membership);

//     const [admins, user] = await Promise.all([
//       this.memberRepo.find({
//         where: { groupId, role: GroupRole.ADMIN, status: MemberStatus.ACTIVE },
//       }),
//       this.userRepo.findOne({ where: { id: userId } }),
//     ]);

//     publishGroupNotification({
//       event: "group:invitation:rejected",
//       targetUserIds: admins.map((a) => a.userId),
//       data: { groupId, user: { id: user!.id, name: user!.name } },
//     }).catch((err) =>
//       console.error("[rejectInvitation] publishGroupNotification error:", err)
//     );
//   }

//   // Pending Invitations

//   async getPendingInvitations(userId: string): Promise<PendingInvitationDTO[]> {
//     const memberships = await this.memberRepo.find({
//       where: { userId, status: MemberStatus.PENDING },
//       relations: ["group", "group.createdBy", "invitedBy"],
//     });

//     return memberships.map((m) => ({
//       groupId: m.groupId,
//       groupName: m.group.name,
//       groupAvatar: m.group.avatar,
//       groupDescription: m.group.description,
//       invitedBy: {
//         id: m.invitedBy?.id ?? "",
//         name: m.invitedBy?.name ?? "",
//         avatar: m.invitedBy?.avatar ?? null,
//       },
//       invitedAt: m.invitedAt,
//     }));
//   }

//   // Groups List

//   async getUserGroups(userId: string): Promise<GroupSummaryDTO[]> {
//     const memberships = await this.memberRepo.find({
//       where: { userId, status: MemberStatus.ACTIVE },
//       relations: ["group", "group.members", "group.members.user"],
//       order: { group: { lastMessageAt: "DESC" } },
//     });

//     return memberships.map(({ group, unreadCount, lastReadAt, role }) => {
//       const activeMembers = group.members.filter(
//         (m) => m.status === MemberStatus.ACTIVE
//       );

//       // ✅ FIX: Nếu lastReadAt >= lastMessageAt thì unread = 0
//       // Tránh case DB chưa kịp reset unread_count nhưng user đã đọc
//       const effectiveUnread =
//         lastReadAt && group.lastMessageAt && lastReadAt >= group.lastMessageAt
//           ? 0
//           : unreadCount;

//       return {
//         id: group.id,
//         name: group.name,
//         description: group.description,
//         avatar: group.avatar,
//         lastMessage: group.lastMessage,
//         lastMessageAt: group.lastMessageAt,
//         lastMessageSenderId: group.lastMessageSenderId,
//         unreadCount: effectiveUnread, // ✅ dùng effectiveUnread
//         role,
//         memberCount: group.memberCount,
//         members: activeMembers.map(
//           (m): GroupMemberPreviewDTO => ({
//             id: m.userId,
//             name: m.user.name,
//             avatar: m.user.avatar,
//             email: m.user.email,
//             role: m.role,
//           })
//         ),
//         createdAt: group.createdAt,
//       };
//     });
//   }

//   // Group Details

//   async getGroupDetails(
//     userId: string,
//     groupId: string
//   ): Promise<GroupDetailDTO> {
//     await this.assertActiveMember(userId, groupId);

//     const group = await this.groupRepo.findOne({
//       where: { id: groupId },
//       relations: ["members", "members.user", "members.invitedBy", "createdBy"],
//     });
//     if (!group) throw new NotFoundError("Group not found");

//     return {
//       id: group.id,
//       name: group.name,
//       description: group.description,
//       avatar: group.avatar,
//       createdBy: { id: group.createdBy.id, name: group.createdBy.name },
//       members: group.members.map((m) => ({
//         id: m.userId,
//         name: m.user.name,
//         avatar: m.user.avatar,
//         email: m.user.email,
//         role: m.role,
//         status: m.status,
//         joinedAt: m.respondedAt,
//         invitedBy: m.invitedBy
//           ? { id: m.invitedBy.id, name: m.invitedBy.name }
//           : null,
//       })),
//       createdAt: group.createdAt,
//     };
//   }

//   // Messages

//   async getGroupMessages(
//     userId: string,
//     groupId: string,
//     page: number = 1,
//     limit: number = 50
//   ): Promise<GroupMessagesResult> {
//     await this.assertActiveMember(userId, groupId);

//     const skip = (page - 1) * limit;

//     const [messages, total] = await this.messageRepo.findAndCount({
//       where: { groupId, isDeleted: false },
//       relations: ["sender", "replyTo", "replyTo.sender", "seenBy"],
//       order: { createdAt: "DESC" },
//       take: limit,
//       skip,
//     });

//     return {
//       messages: messages
//         .reverse()
//         .map((msg) => this.formatMessage(msg, userId)),
//       total,
//       hasMore: skip + messages.length < total,
//     };
//   }

//   async sendGroupMessage(
//     senderId: string,
//     groupId: string,
//     data: SendGroupMessageData
//   ): Promise<GroupMessageDTO> {
//     const membership = await this.memberRepo
//       .createQueryBuilder("m")
//       .innerJoinAndSelect("m.user", "u")
//       .where(
//         "m.userId = :senderId AND m.groupId = :groupId AND m.status = :status",
//         { senderId, groupId, status: MemberStatus.ACTIVE }
//       )
//       .select(["m.id", "m.role", "u.id", "u.name", "u.avatar"])
//       .getOne();

//     if (!membership) {
//       throw new ForbiddenError("You are not an active member of this group");
//     }

//     const sender = membership.user;

//     const {
//       content,
//       type = MessageType.TEXT,
//       fileUrl,
//       filePublicId,
//       fileName,
//       fileSize,
//       fileMimeType,
//       replyToId,
//     } = data;

//     if (type === MessageType.TEXT && !content?.trim()) {
//       throw new BadRequestError(
//         "Message content is required for text messages"
//       );
//     }
//     if (type !== MessageType.TEXT && !fileUrl) {
//       throw new BadRequestError("fileUrl is required for media messages");
//     }

//     const replyTo = replyToId
//       ? await this.messageRepo.findOne({
//           where: { id: replyToId, groupId, isDeleted: false },
//           select: ["id", "content", "senderId", "type", "isDeleted"],
//         })
//       : null;

//     if (replyToId && !replyTo) {
//       throw new NotFoundError("Replied message not found");
//     }

//     const message = this.messageRepo.create({
//       groupId,
//       senderId,
//       content: content || null,
//       type,
//       fileUrl: fileUrl || null,
//       filePublicId: filePublicId || null,
//       fileName: fileName || null,
//       fileSize: fileSize || null,
//       fileMimeType: fileMimeType || null,
//       replyToId: replyToId || null,
//     });
//     await this.messageRepo.save(message);

//     const formatted: GroupMessageDTO = {
//       id: message.id,
//       groupId,
//       senderId,
//       senderName: sender.name,
//       senderAvatar: sender.avatar ?? null,
//       content: content || null,
//       type,
//       fileUrl: fileUrl || null,
//       fileName: fileName || null,
//       fileSize: fileSize || null,
//       fileMimeType: fileMimeType || null,
//       replyTo: replyTo
//         ? {
//             id: replyTo.id,
//             content: replyTo.content,
//             senderId: replyTo.senderId,
//             senderName: null,
//             isDeleted: replyTo.isDeleted,
//           }
//         : null,
//       seenBy: [],
//       seenByMe: true,
//       isDeleted: false,
//       createdAt: message.createdAt,
//     };

//     // const wsService = getWebSocketService();
//     // wsService.sendToGroup(groupId, "group:message:new", {
//     //   groupId,
//     //   message: formatted,
//     // });
//     // Chỉ giữ publish vào MQ — worker fan-out cho tất cả members kể cả sender
//     // await publishGroupMessage({
//     //   groupId,
//     //   message: formatted,
//     //   senderUserId: senderId,
//     // });

//     // Fire-and-forget tất cả side effects — không block HTTP response
//     Promise.all([
//       this.groupRepo.update(groupId, {
//         lastMessage: type === MessageType.TEXT ? content : `[${type}]`,
//         lastMessageSenderId: senderId,
//         lastMessageAt: new Date(),
//       }),
//       this.incrementUnreadAndMarkSeen(senderId, groupId, message.id),
//       publishGroupMessage({
//         // chỉ gọi 1 lần duy nhất
//         groupId,
//         message: formatted,
//         senderUserId: senderId,
//       }),
//     ]).catch((err) => {
//       console.error("[sendGroupMessage] side effects error:", err);
//     });

//     return formatted; // trả về ngay, không await MQ
//   }

//   private async incrementUnreadAndMarkSeen(
//     senderId: string,
//     groupId: string,
//     messageId: string
//   ): Promise<void> {
//     await Promise.all([
//       this.memberRepo
//         .createQueryBuilder()
//         .update(GroupMember)
//         .set({ unreadCount: () => "unread_count + 1" })
//         .where(
//           "group_id = :groupId AND user_id != :senderId AND status = :status",
//           { groupId, senderId, status: MemberStatus.ACTIVE }
//         )
//         .execute(),
//       this.markMessageSeen(senderId, messageId, groupId),
//     ]);
//   }

//   // Upload Media

//   async uploadGroupMedia(
//     userId: string,
//     groupId: string,
//     buffer: Buffer,
//     mimeType: string,
//     originalName: string,
//     fileSize: number
//   ): Promise<UploadedMedia> {
//     await this.assertActiveMember(userId, groupId);
//     return uploadChatMedia(buffer, mimeType, originalName, fileSize);
//   }

//   // Seen / Read Receipts

//   async markGroupAsRead(userId: string, groupId: string): Promise<void> {
//     await this.assertActiveMember(userId, groupId);

//     // Reset unread counter trước — luôn thực hiện ngay cả khi không có tin chưa đọc
//     await this.memberRepo.update(
//       { userId, groupId },
//       { unreadCount: 0, lastReadAt: new Date() }
//     );

//     /**
//      * FIX: Table name phải là "group_messages" (có chữ s) — khớp với
//      * @Entity("group_messages") trong GroupMessage entity.
//      * Trước đây dùng "group_message" (không có s) → QueryFailedError 400.
//      *
//      * CTE này atomically:
//      * 1. Tìm các tin chưa seen bởi userId trong group
//      * 2. Insert seen records cho tất cả (ON CONFLICT DO NOTHING)
//      * 3. Trả về sender IDs để publish notification
//      */
//     const senderRows: Array<{ sender_id: string }> = await AppDataSource.query(
//       `
//       WITH unseen AS (
//         SELECT msg.id, msg.sender_id
//         FROM group_messages msg
//         LEFT JOIN group_message_seen seen
//           ON seen.message_id = msg.id AND seen.user_id = $1
//         WHERE msg.group_id = $2
//           AND msg.sender_id != $1
//           AND msg.is_deleted = false
//           AND seen.id IS NULL
//       ),
//       inserted AS (
//         INSERT INTO group_message_seen (message_id, user_id, group_id, seen_at)
//         SELECT id, $1, $2, NOW() FROM unseen
//         ON CONFLICT (message_id, user_id) DO NOTHING
//         RETURNING message_id
//       )
//       SELECT DISTINCT sender_id FROM unseen
//       `,
//       [userId, groupId]
//     );

//     const senderIds = senderRows.map((r) => r.sender_id);

//     if (senderIds.length > 0) {
//       publishGroupNotification({
//         event: "group:messages:seen",
//         targetUserIds: senderIds,
//         data: { groupId, seenBy: userId, seenAt: new Date() },
//       }).catch((err) =>
//         console.error("[markGroupAsRead] publishGroupNotification error:", err)
//       );
//     }
//   }

//   private async markMessageSeen(
//     userId: string,
//     messageId: string,
//     groupId: string
//   ): Promise<void> {
//     await AppDataSource.query(
//       `
//       INSERT INTO group_message_seen (message_id, user_id, group_id, seen_at)
//       VALUES ($1, $2, $3, NOW())
//       ON CONFLICT (message_id, user_id) DO NOTHING
//       `,
//       [messageId, userId, groupId]
//     );
//   }

//   // Member Management

//   async addMembers(
//     requesterId: string,
//     groupId: string,
//     userIds: string[]
//   ): Promise<AddMembersResult> {
//     await this.assertAdmin(requesterId, groupId);

//     const group = await this.groupRepo.findOne({ where: { id: groupId } });
//     if (!group) throw new NotFoundError("Group not found");

//     if (!userIds?.length) throw new BadRequestError("No user IDs provided");

//     const uniqueIds = [...new Set(userIds)].filter((id) => id !== requesterId);
//     if (!uniqueIds.length) return { invited: [], skipped: [] };

//     const users = await this.userRepo.findByIds(uniqueIds);
//     if (users.length !== uniqueIds.length) {
//       const foundIds = new Set(users.map((u) => u.id));
//       const missing = uniqueIds.filter((id) => !foundIds.has(id));
//       throw new BadRequestError(`Users not found: ${missing.join(", ")}`);
//     }

//     const existingMemberships = await this.memberRepo.find({
//       where: uniqueIds.map((userId) => ({ groupId, userId })),
//     });
//     const existingMap = new Map(existingMemberships.map((m) => [m.userId, m]));

//     const toCreate: string[] = [];
//     const toReinvite: GroupMember[] = [];
//     const skipped: string[] = [];

//     for (const userId of uniqueIds) {
//       const existing = existingMap.get(userId);

//       if (!existing) {
//         toCreate.push(userId);
//       } else if (
//         existing.status === MemberStatus.KICKED ||
//         existing.status === MemberStatus.LEFT ||
//         existing.status === MemberStatus.REJECTED
//       ) {
//         existing.status = MemberStatus.PENDING;
//         existing.invitedAt = new Date();
//         existing.invitedById = requesterId;
//         existing.respondedAt = null as any;
//         toReinvite.push(existing);
//       } else {
//         skipped.push(userId);
//       }
//     }

//     await Promise.all([
//       toCreate.length > 0
//         ? this.memberRepo.save(
//             toCreate.map((userId) =>
//               this.memberRepo.create({
//                 groupId,
//                 userId,
//                 role: GroupRole.MEMBER,
//                 status: MemberStatus.PENDING,
//                 invitedAt: new Date(),
//                 invitedById: requesterId,
//               })
//             )
//           )
//         : Promise.resolve(),
//       toReinvite.length > 0
//         ? this.memberRepo.save(toReinvite)
//         : Promise.resolve(),
//     ]);

//     const allInvited = [...toCreate, ...toReinvite.map((m) => m.userId)];

//     if (allInvited.length > 0) {
//       const requester = await this.userRepo.findOne({
//         where: { id: requesterId },
//       });

//       publishGroupNotification({
//         event: "group:invitation",
//         targetUserIds: allInvited,
//         data: {
//           groupId,
//           groupName: group.name,
//           invitedBy: {
//             id: requester!.id,
//             name: requester!.name,
//             avatar: requester!.avatar,
//           },
//           actions: { accept: true, reject: true },
//         },
//       }).catch((err) =>
//         console.error("[addMembers] publishGroupNotification error:", err)
//       );
//     }

//     return { invited: allInvited, skipped };
//   }

//   async removeMember(
//     requesterId: string,
//     groupId: string,
//     targetUserId: string
//   ): Promise<void> {
//     const isSelf = requesterId === targetUserId;
//     if (!isSelf) await this.assertAdmin(requesterId, groupId);

//     const membership = await this.memberRepo.findOne({
//       where: { groupId, userId: targetUserId, status: MemberStatus.ACTIVE },
//     });
//     if (!membership) throw new NotFoundError("Active member not found");

//     if (membership.role === GroupRole.ADMIN) {
//       const adminCount = await this.memberRepo.count({
//         where: { groupId, role: GroupRole.ADMIN, status: MemberStatus.ACTIVE },
//       });
//       if (adminCount <= 1) {
//         throw new BadRequestError(
//           "Cannot remove the only admin. Promote another member first."
//         );
//       }
//     }

//     membership.status = isSelf ? MemberStatus.LEFT : MemberStatus.KICKED;
//     await this.memberRepo.save(membership);

//     await this.groupRepo
//       .createQueryBuilder()
//       .update(Group)
//       .set({ memberCount: () => "GREATEST(member_count - 1, 0)" })
//       .where("id = :groupId", { groupId })
//       .execute();

//     const remaining = await this.memberRepo.find({
//       where: { groupId, status: MemberStatus.ACTIVE },
//     });

//     publishGroupNotification({
//       event: "group:member:removed",
//       targetUserIds: [targetUserId, ...remaining.map((m) => m.userId)],
//       data: { groupId, removedUserId: targetUserId, isSelf },
//     }).catch((err) =>
//       console.error("[removeMember] publishGroupNotification error:", err)
//     );
//   }

//   async promoteMember(
//     requesterId: string,
//     groupId: string,
//     targetUserId: string
//   ): Promise<void> {
//     await this.assertAdmin(requesterId, groupId);

//     const membership = await this.memberRepo.findOne({
//       where: { groupId, userId: targetUserId, status: MemberStatus.ACTIVE },
//     });
//     if (!membership)
//       throw new NotFoundError("Active member not found in group");

//     membership.role = GroupRole.ADMIN;
//     await this.memberRepo.save(membership);

//     publishGroupNotification({
//       event: "group:member:promoted",
//       targetUserIds: [targetUserId],
//       data: { groupId, promotedUserId: targetUserId },
//     }).catch((err) =>
//       console.error("[promoteMember] publishGroupNotification error:", err)
//     );
//   }

//   // group-chat.service.ts — fix deleteGroupMessage
//   async deleteGroupMessage(
//     userId: string,
//     groupId: string,
//     messageId: string
//   ): Promise<void> {
//     // FIX: assertActiveMember trước, đảm bảo chỉ ACTIVE member mới xóa được
//     const membership = await this.assertActiveMember(userId, groupId);

//     const message = await this.messageRepo.findOne({
//       where: { id: messageId, groupId, isDeleted: false },
//     });
//     if (!message) throw new NotFoundError("Message not found");

//     // FIX: check role từ membership đã có sẵn — không query lại
//     if (message.senderId !== userId && membership.role !== GroupRole.ADMIN) {
//       throw new ForbiddenError("Not authorized to delete this message");
//     }

//     message.isDeleted = true;
//     await this.messageRepo.save(message);

//     const previousMessage = await this.messageRepo.findOne({
//       where: { groupId, isDeleted: false },
//       order: { createdAt: "DESC" },
//     });

//     const group = await this.groupRepo.findOne({ where: { id: groupId } });
//     if (group) {
//       // FIX: chỉ update lastMessage khi tin bị xóa đúng là lastMessage hiện tại
//       const isLastMessage =
//         group.lastMessageAt?.getTime() === message.createdAt?.getTime() ||
//         group.lastMessageSenderId === message.senderId;

//       if (isLastMessage) {
//         group.lastMessage = previousMessage
//           ? previousMessage.type === MessageType.TEXT
//             ? previousMessage.content
//             : `[${previousMessage.type}]`
//           : null;
//         group.lastMessageAt = previousMessage?.createdAt ?? null;
//         group.lastMessageSenderId = previousMessage?.senderId ?? null;
//         await this.groupRepo.save(group);
//       }
//     }

//     const activeMembers = await this.memberRepo.find({
//       where: { groupId, status: MemberStatus.ACTIVE },
//     });

//     const notifyDelete = () =>
//       publishGroupNotification({
//         event: "group:message:deleted",
//         targetUserIds: activeMembers.map((m) => m.userId),
//         data: {
//           groupId,
//           messageId,
//           previousMessage: previousMessage
//             ? {
//                 id: previousMessage.id,
//                 content: previousMessage.content,
//                 type: previousMessage.type,
//                 senderId: previousMessage.senderId,
//                 createdAt: previousMessage.createdAt,
//               }
//             : null,
//         },
//       }).catch((err) =>
//         console.error(
//           "[deleteGroupMessage] publishGroupNotification error:",
//           err
//         )
//       );

//     if (message.filePublicId) {
//       const rt =
//         message.type === MessageType.IMAGE
//           ? "image"
//           : message.type === MessageType.VIDEO
//             ? "video"
//             : "raw";
//       Promise.all([
//         deleteChatMedia(message.filePublicId, rt as any),
//         notifyDelete(),
//       ]).catch(console.error);
//     } else {
//       notifyDelete();
//     }
//   }

//   // WebSocket Sync on Reconnect

//   async syncOnReconnect(userId: string): Promise<void> {
//     const [groups, pendingInvites] = await Promise.all([
//       this.getUserGroups(userId),
//       this.getPendingInvitations(userId),
//     ]);

//     try {
//       const wsService = getWebSocketService();
//       wsService.sendToUser(userId, "sync:groups", {
//         groups,
//         pendingInvitations: pendingInvites,
//         syncedAt: new Date(),
//       });
//     } catch (err) {
//       console.error("[syncOnReconnect] error:", err);
//     }
//   }

//   // Helpers

//   private async assertActiveMember(
//     userId: string,
//     groupId: string
//   ): Promise<GroupMember> {
//     const membership = await this.memberRepo.findOne({
//       where: { userId, groupId, status: MemberStatus.ACTIVE },
//     });
//     if (!membership) {
//       throw new ForbiddenError("You are not an active member of this group");
//     }
//     return membership;
//   }

//   private async assertAdmin(userId: string, groupId: string): Promise<void> {
//     const membership = await this.assertActiveMember(userId, groupId);
//     if (membership.role !== GroupRole.ADMIN) {
//       throw new ForbiddenError("Only admins can perform this action");
//     }
//   }

//   private formatMessage(
//     msg: GroupMessage,
//     currentUserId?: string
//   ): GroupMessageDTO {
//     return {
//       id: msg.id,
//       groupId: msg.groupId,
//       senderId: msg.senderId,
//       senderName: msg.sender?.name ?? "",
//       senderAvatar: msg.sender?.avatar ?? null,
//       content: msg.isDeleted ? null : msg.content,
//       isDeleted: msg.isDeleted,
//       type: msg.type,
//       fileUrl: msg.isDeleted ? null : msg.fileUrl,
//       fileName: msg.isDeleted ? null : msg.fileName,
//       fileSize: msg.fileSize,
//       fileMimeType: msg.fileMimeType,
//       replyTo: msg.replyTo
//         ? {
//             id: msg.replyTo.id,
//             content: msg.replyTo.isDeleted ? null : msg.replyTo.content,
//             senderId: msg.replyTo.senderId,
//             senderName: msg.replyTo.sender?.name ?? null,
//             isDeleted: msg.replyTo.isDeleted,
//           }
//         : null,
//       seenBy: (msg.seenBy || []).map((s) => ({
//         userId: s.userId,
//         seenAt: s.seenAt,
//       })),
//       seenByMe: currentUserId
//         ? (msg.seenBy || []).some((s) => s.userId === currentUserId)
//         : false,
//       createdAt: msg.createdAt,
//     };
//   }
// }

// export const groupChatService = new GroupChatService();

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
import {
  GroupMessageDTO,
  GroupSummaryDTO,
  GroupDetailDTO,
  PendingInvitationDTO,
  GroupMessagesResult,
  AddMembersResult,
  GroupMemberPreviewDTO,
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

export class GroupChatService {
  private groupRepo = AppDataSource.getRepository(Group);
  private memberRepo = AppDataSource.getRepository(GroupMember);
  private messageRepo = AppDataSource.getRepository(GroupMessage);
  private seenRepo = AppDataSource.getRepository(GroupMessageSeen);
  private userRepo = AppDataSource.getRepository(User);

  // ─── Group Creation ────────────────────────────────────────────────────────

  async createGroup(creatorId: string, data: CreateGroupData): Promise<Group> {
    const { name, description, memberIds } = data;

    if (!name?.trim()) throw new BadRequestError("Group name is required");

    const inviteeIds = [...new Set(memberIds.filter((id) => id !== creatorId))];

    const allIds = [creatorId, ...inviteeIds];
    const users = await this.userRepo.findByIds(allIds);
    const userMap = new Map(users.map((u) => [u.id, u]));
    if (!userMap.has(creatorId)) throw new BadRequestError("Creator not found");
    if (inviteeIds.some((id) => !userMap.has(id))) {
      throw new BadRequestError("One or more invited users not found");
    }

    const group = this.groupRepo.create({
      name: name.trim(),
      description: description?.trim() || null,
      createdById: creatorId,
      memberCount: 1,
    });
    await this.groupRepo.save(group);

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

  // ─── Update Group ──────────────────────────────────────────────────────────

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

    const activeMembers = await this.memberRepo.find({
      where: { groupId, status: MemberStatus.ACTIVE },
    });

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

  // ─── Invitation Response ───────────────────────────────────────────────────

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

    await this.groupRepo
      .createQueryBuilder()
      .update(Group)
      .set({ memberCount: () => "member_count + 1" })
      .where("id = :groupId", { groupId })
      .execute();

    const [user, activeMembers, fullGroup] = await Promise.all([
      this.userRepo.findOne({ where: { id: userId } }),
      this.memberRepo.find({ where: { groupId, status: MemberStatus.ACTIVE } }),
      this.groupRepo.findOne({
        where: { id: groupId },
        relations: ["members", "members.user", "createdBy"],
      }),
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
    }).catch((err) =>
      console.error("[acceptInvitation] publishGroupNotification error:", err)
    );

    try {
      const wsService = getWebSocketService();
      wsService.sendToUser(userId, "group:joined", { group: fullGroup });
    } catch {}
  }

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

    const [admins, user] = await Promise.all([
      this.memberRepo.find({
        where: { groupId, role: GroupRole.ADMIN, status: MemberStatus.ACTIVE },
      }),
      this.userRepo.findOne({ where: { id: userId } }),
    ]);

    publishGroupNotification({
      event: "group:invitation:rejected",
      targetUserIds: admins.map((a) => a.userId),
      data: { groupId, user: { id: user!.id, name: user!.name } },
    }).catch((err) =>
      console.error("[rejectInvitation] publishGroupNotification error:", err)
    );
  }

  // ─── Pending Invitations ───────────────────────────────────────────────────

  async getPendingInvitations(userId: string): Promise<PendingInvitationDTO[]> {
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
        id: m.invitedBy?.id ?? "",
        name: m.invitedBy?.name ?? "",
        avatar: m.invitedBy?.avatar ?? null,
      },
      invitedAt: m.invitedAt,
    }));
  }

  // ─── Groups List ───────────────────────────────────────────────────────────

  async getUserGroups(userId: string): Promise<GroupSummaryDTO[]> {
    const memberships = await this.memberRepo.find({
      where: { userId, status: MemberStatus.ACTIVE },
      relations: ["group", "group.members", "group.members.user"],
      order: { group: { lastMessageAt: "DESC" } },
    });

    return memberships.map(({ group, unreadCount, lastReadAt, role }) => {
      const activeMembers = group.members.filter(
        (m) => m.status === MemberStatus.ACTIVE
      );

      /**
       * BUG FIX (Bug 4/5): effectiveUnread đảm bảo rằng nếu lastReadAt >= lastMessageAt
       * thì unread = 0 dù DB chưa kịp reset (race condition khi reconnect nhanh).
       * Điều này fix cả trường hợp login lại thấy unread = 1 dù đã đọc hết.
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

  // ─── Group Details ─────────────────────────────────────────────────────────

  async getGroupDetails(
    userId: string,
    groupId: string
  ): Promise<GroupDetailDTO> {
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

  // ─── Messages ──────────────────────────────────────────────────────────────

  async getGroupMessages(
    userId: string,
    groupId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<GroupMessagesResult> {
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
  ): Promise<GroupMessageDTO> {
    const membership = await this.memberRepo
      .createQueryBuilder("m")
      .innerJoinAndSelect("m.user", "u")
      .where(
        "m.userId = :senderId AND m.groupId = :groupId AND m.status = :status",
        { senderId, groupId, status: MemberStatus.ACTIVE }
      )
      .select(["m.id", "m.role", "u.id", "u.name", "u.avatar"])
      .getOne();

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
      ? await this.messageRepo.findOne({
          where: { id: replyToId, groupId, isDeleted: false },
          select: ["id", "content", "senderId", "type", "isDeleted"],
        })
      : null;

    if (replyToId && !replyTo) {
      throw new NotFoundError("Replied message not found");
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

    const formatted: GroupMessageDTO = {
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
            senderName: null,
            isDeleted: replyTo.isDeleted,
          }
        : null,
      seenBy: [],
      seenByMe: true,
      isDeleted: false,
      createdAt: message.createdAt,
    };

    // Fire-and-forget tất cả side effects — không block HTTP response
    Promise.all([
      this.groupRepo.update(groupId, {
        lastMessage: type === MessageType.TEXT ? content : `[${type}]`,
        lastMessageSenderId: senderId,
        lastMessageAt: new Date(),
      }),
      this.incrementUnreadAndMarkSeen(senderId, groupId, message.id),
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

  private async incrementUnreadAndMarkSeen(
    senderId: string,
    groupId: string,
    messageId: string
  ): Promise<void> {
    await Promise.all([
      this.memberRepo
        .createQueryBuilder()
        .update(GroupMember)
        .set({ unreadCount: () => "unread_count + 1" })
        .where(
          "group_id = :groupId AND user_id != :senderId AND status = :status",
          { groupId, senderId, status: MemberStatus.ACTIVE }
        )
        .execute(),
      this.markMessageSeen(senderId, messageId, groupId),
    ]);
  }

  // ─── Upload Media ──────────────────────────────────────────────────────────

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

  // ─── Seen / Read Receipts ──────────────────────────────────────────────────

  async markGroupAsRead(userId: string, groupId: string): Promise<void> {
    await this.assertActiveMember(userId, groupId);

    // Reset unread counter + update lastReadAt — đây là nguồn sự thật để
    // getUserGroups tính effectiveUnread đúng sau khi reconnect / login lại
    await this.memberRepo.update(
      { userId, groupId },
      { unreadCount: 0, lastReadAt: new Date() }
    );

    /**
     * CTE này atomically:
     * 1. Tìm các tin chưa seen bởi userId trong group
     * 2. Insert seen records cho tất cả (ON CONFLICT DO NOTHING)
     * 3. Trả về sender IDs để publish notification
     */
    const senderRows: Array<{ sender_id: string }> = await AppDataSource.query(
      `
      WITH unseen AS (
        SELECT msg.id, msg.sender_id
        FROM group_messages msg
        LEFT JOIN group_message_seen seen
          ON seen.message_id = msg.id AND seen.user_id = $1
        WHERE msg.group_id = $2
          AND msg.sender_id != $1
          AND msg.is_deleted = false
          AND seen.id IS NULL
      ),
      inserted AS (
        INSERT INTO group_message_seen (message_id, user_id, group_id, seen_at)
        SELECT id, $1, $2, NOW() FROM unseen
        ON CONFLICT (message_id, user_id) DO NOTHING
        RETURNING message_id
      )
      SELECT DISTINCT sender_id FROM unseen
      `,
      [userId, groupId]
    );

    const senderIds = senderRows.map((r) => r.sender_id);

    if (senderIds.length > 0) {
      publishGroupNotification({
        event: "group:messages:seen",
        targetUserIds: senderIds,
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
    await AppDataSource.query(
      `
      INSERT INTO group_message_seen (message_id, user_id, group_id, seen_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (message_id, user_id) DO NOTHING
      `,
      [messageId, userId, groupId]
    );
  }

  // ─── Member Management ─────────────────────────────────────────────────────

  async addMembers(
    requesterId: string,
    groupId: string,
    userIds: string[]
  ): Promise<AddMembersResult> {
    await this.assertAdmin(requesterId, groupId);

    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundError("Group not found");

    if (!userIds?.length) throw new BadRequestError("No user IDs provided");

    const uniqueIds = [...new Set(userIds)].filter((id) => id !== requesterId);
    if (!uniqueIds.length) return { invited: [], skipped: [] };

    const users = await this.userRepo.findByIds(uniqueIds);
    if (users.length !== uniqueIds.length) {
      const foundIds = new Set(users.map((u) => u.id));
      const missing = uniqueIds.filter((id) => !foundIds.has(id));
      throw new BadRequestError(`Users not found: ${missing.join(", ")}`);
    }

    const existingMemberships = await this.memberRepo.find({
      where: uniqueIds.map((userId) => ({ groupId, userId })),
    });
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
        existing.respondedAt = null as any;
        toReinvite.push(existing);
      } else {
        skipped.push(userId);
      }
    }

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

    await this.groupRepo
      .createQueryBuilder()
      .update(Group)
      .set({ memberCount: () => "GREATEST(member_count - 1, 0)" })
      .where("id = :groupId", { groupId })
      .execute();

    const remaining = await this.memberRepo.find({
      where: { groupId, status: MemberStatus.ACTIVE },
    });

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

    publishGroupNotification({
      event: "group:member:promoted",
      targetUserIds: [targetUserId],
      data: { groupId, promotedUserId: targetUserId },
    }).catch((err) =>
      console.error("[promoteMember] publishGroupNotification error:", err)
    );
  }

  /**
   * BUG FIX (Bug 2): Các lỗi gốc:
   * 1. Query membership không filter status: ACTIVE → KICKED/LEFT user vẫn xóa được
   * 2. Lần 2 gọi xóa báo lỗi vì message.isDeleted = true (NotFoundError đúng)
   *    nhưng người dùng thấy lỗi vì UI không update sau lần xóa đầu
   * 3. Condition `if (!group.lastMessage || group.lastMessageAt)` luôn true
   *    → luôn update group kể cả khi tin bị xóa không phải lastMessage
   *
   * Fix:
   * - Gọi assertActiveMember đầu tiên (đã có status: ACTIVE filter)
   * - Dùng membership từ assertActiveMember để check role (không query lại)
   * - Fix condition check lastMessage: so sánh messageId với lastMessage đúng cách
   */
  async deleteGroupMessage(
    userId: string,
    groupId: string,
    messageId: string
  ): Promise<void> {
    // assertActiveMember đảm bảo chỉ ACTIVE member mới vào được — fix KICKED user bug
    const membership = await this.assertActiveMember(userId, groupId);

    const message = await this.messageRepo.findOne({
      where: { id: messageId, groupId, isDeleted: false },
    });
    if (!message) throw new NotFoundError("Message not found");

    // Dùng membership đã có — không query lại
    if (message.senderId !== userId && membership.role !== GroupRole.ADMIN) {
      throw new ForbiddenError("Not authorized to delete this message");
    }

    message.isDeleted = true;
    await this.messageRepo.save(message);

    // Tìm tin nhắn kế trước (không bị xóa)
    const previousMessage = await this.messageRepo.findOne({
      where: { groupId, isDeleted: false },
      order: { createdAt: "DESC" },
    });

    // BUG FIX: Chỉ update group.lastMessage khi tin bị xóa đúng là lastMessage hiện tại
    // Cách check: so sánh senderId + timestamp (không dùng messageId vì group không lưu lastMessageId)
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (group) {
      const deletedIsLast =
        group.lastMessageSenderId === message.senderId &&
        group.lastMessageAt !== null &&
        Math.abs(
          new Date(group.lastMessageAt).getTime() -
            new Date(message.createdAt).getTime()
        ) < 2000; // 2 giây tolerance cho clock skew

      if (deletedIsLast) {
        group.lastMessage = previousMessage
          ? previousMessage.type === MessageType.TEXT
            ? previousMessage.content
            : `[${previousMessage.type}]`
          : null;
        group.lastMessageAt = previousMessage?.createdAt ?? null;
        group.lastMessageSenderId = previousMessage?.senderId ?? null;
        await this.groupRepo.save(group);
      }
    }

    const activeMembers = await this.memberRepo.find({
      where: { groupId, status: MemberStatus.ACTIVE },
    });

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
      }).catch((err) =>
        console.error(
          "[deleteGroupMessage] publishGroupNotification error:",
          err
        )
      );

    if (message.filePublicId) {
      const rt =
        message.type === MessageType.IMAGE
          ? "image"
          : message.type === MessageType.VIDEO
            ? "video"
            : "raw";
      Promise.all([
        deleteChatMedia(message.filePublicId, rt as any),
        notifyDelete(),
      ]).catch(console.error);
    } else {
      notifyDelete();
    }
  }

  // ─── WebSocket Sync on Reconnect ───────────────────────────────────────────

  async syncOnReconnect(userId: string): Promise<void> {
    const [groups, pendingInvites] = await Promise.all([
      this.getUserGroups(userId), // đã tính effectiveUnread đúng
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

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async assertActiveMember(
    userId: string,
    groupId: string
  ): Promise<GroupMember> {
    const membership = await this.memberRepo.findOne({
      where: { userId, groupId, status: MemberStatus.ACTIVE },
    });
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
