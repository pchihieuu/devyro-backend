import { EntityManager, In } from "typeorm";
import { AppDataSource } from "../config/database.config";
import { Group } from "../entities/Group.entity";
import {
  GroupMember,
  GroupRole,
  MemberStatus,
} from "../entities/GroupMember.entity";
import { GroupMessage, MessageType } from "../entities/GroupMessage.entity";
import { User } from "../entities/User.entity";
import { containsPattern } from "../utils/like.util";
import { outboxRepository } from "./outbox.repository";

/**
 * Repository DUY NHẤT của module group-chat được phép đụng tới TypeORM /
 * AppDataSource (layer boundary của backend-module-pattern). Service chỉ gọi
 * các method mang tên nghiệp vụ dưới đây.
 */

/** Quan hệ dùng chung khi trả full group (create/update/join). */
const GROUP_FULL_RELATIONS = ["members", "members.user", "createdBy"];

/** Chỉ lấy field cần thiết của user để build DTO — tránh kéo cả row user. */
const USER_REF_FIELDS = ["id", "name", "avatar"] as const;

export interface NewMessageData {
  groupId: string;
  senderId: string;
  content: string | null;
  type: MessageType;
  fileUrl: string | null;
  filePublicId: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileMimeType: string | null;
  replyToId: string | null;
}

export type ExitStatus = MemberStatus.LEFT | MemberStatus.KICKED;

export class GroupChatRepository {
  private groupRepo = AppDataSource.getRepository(Group);
  private memberRepo = AppDataSource.getRepository(GroupMember);
  private messageRepo = AppDataSource.getRepository(GroupMessage);
  private userRepo = AppDataSource.getRepository(User);

  // ─── Users ────────────────────────────────────────────────────────────────

  async findUsersByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return this.userRepo.find({
      where: { id: In(ids) },
      select: [...USER_REF_FIELDS],
    });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      select: [...USER_REF_FIELDS],
    });
  }

  // ─── Groups ───────────────────────────────────────────────────────────────

  /**
   * Tạo group + creator (ADMIN/ACTIVE) + các lời mời PENDING trong 1
   * transaction. Trước đây 3 lần save độc lập → lỗi giữa chừng để lại group
   * mồ côi không có admin.
   */
  async createGroupWithMembers(params: {
    creatorId: string;
    name: string;
    description: string | null;
    inviteeIds: string[];
  }): Promise<Group> {
    const { creatorId, name, description, inviteeIds } = params;

    const groupId = await AppDataSource.transaction(
      async (manager: EntityManager) => {
        const now = new Date();
        const group = await manager.save(
          manager.create(Group, {
            name,
            description,
            createdById: creatorId,
            memberCount: 1,
          })
        );

        const members = [
          manager.create(GroupMember, {
            groupId: group.id,
            userId: creatorId,
            role: GroupRole.ADMIN,
            status: MemberStatus.ACTIVE,
            invitedAt: now,
            invitedById: creatorId,
            respondedAt: now,
          }),
          ...inviteeIds.map((userId) =>
            manager.create(GroupMember, {
              groupId: group.id,
              userId,
              role: GroupRole.MEMBER,
              status: MemberStatus.PENDING,
              invitedAt: now,
              invitedById: creatorId,
            })
          ),
        ];
        await manager.save(members);
        return group.id;
      }
    );

    return (await this.findGroupFull(groupId))!;
  }

  async findGroupById(groupId: string): Promise<Group | null> {
    return this.groupRepo.findOne({ where: { id: groupId } });
  }

  /** Group + members + user + createdBy — trả về cho create/update/join. */
  async findGroupFull(groupId: string): Promise<Group | null> {
    return this.groupRepo.findOne({
      where: { id: groupId },
      relations: GROUP_FULL_RELATIONS,
    });
  }

  /** Như findGroupFull nhưng kèm invitedBy — dùng cho trang chi tiết group. */
  async findGroupDetail(groupId: string): Promise<Group | null> {
    return this.groupRepo.findOne({
      where: { id: groupId },
      relations: [...GROUP_FULL_RELATIONS, "members.invitedBy"],
    });
  }

  async saveGroup(group: Group): Promise<Group> {
    return this.groupRepo.save(group);
  }

  /**
   * Danh sách group ACTIVE của user (kèm active members để build preview).
   * - Chỉ join member ACTIVE (trước đây load cả PENDING/LEFT/KICKED rồi lọc
   *   trong JS).
   * - NULLS LAST: group chưa có tin nhắn nằm cuối. `DESC` mặc định của
   *   Postgres đặt NULL LÊN ĐẦU nên group mới tạo luôn đè lên group đang chat.
   */
  async findActiveMembershipsWithGroups(
    userId: string,
    search?: string
  ): Promise<GroupMember[]> {
    const qb = this.memberRepo
      .createQueryBuilder("m")
      .innerJoinAndSelect("m.group", "g")
      .leftJoinAndSelect("g.members", "gm", "gm.status = :active", {
        active: MemberStatus.ACTIVE,
      })
      .leftJoinAndSelect("gm.user", "gu")
      .where("m.userId = :userId AND m.status = :active", { userId })
      .orderBy("g.lastMessageAt", "DESC", "NULLS LAST")
      .addOrderBy("g.createdAt", "DESC");

    if (search?.trim()) {
      qb.andWhere("g.name ILIKE :search", { search: containsPattern(search) });
    }
    return qb.getMany();
  }

  // ─── Membership ───────────────────────────────────────────────────────────

  async findMembership(
    userId: string,
    groupId: string
  ): Promise<GroupMember | null> {
    return this.memberRepo.findOne({ where: { userId, groupId } });
  }

  async findActiveMembership(
    userId: string,
    groupId: string
  ): Promise<GroupMember | null> {
    return this.memberRepo.findOne({
      where: { userId, groupId, status: MemberStatus.ACTIVE },
    });
  }

  /** Membership ACTIVE + thông tin sender tối thiểu — hot path của sendGroupMessage. */
  async findActiveMembershipWithUser(
    userId: string,
    groupId: string
  ): Promise<GroupMember | null> {
    return this.memberRepo
      .createQueryBuilder("m")
      .innerJoin("m.user", "u")
      .addSelect(["u.id", "u.name", "u.avatar"])
      .where("m.userId = :userId AND m.groupId = :groupId AND m.status = :st", {
        userId,
        groupId,
        st: MemberStatus.ACTIVE,
      })
      .getOne();
  }

  async findActiveMembers(groupId: string): Promise<GroupMember[]> {
    return this.memberRepo.find({
      where: { groupId, status: MemberStatus.ACTIVE },
    });
  }

  async findActiveAdmins(groupId: string): Promise<GroupMember[]> {
    return this.memberRepo.find({
      where: { groupId, role: GroupRole.ADMIN, status: MemberStatus.ACTIVE },
    });
  }

  async countActiveAdmins(groupId: string): Promise<number> {
    return this.memberRepo.count({
      where: { groupId, role: GroupRole.ADMIN, status: MemberStatus.ACTIVE },
    });
  }

  async findMembershipsOfUsers(
    groupId: string,
    userIds: string[]
  ): Promise<GroupMember[]> {
    if (userIds.length === 0) return [];
    return this.memberRepo.find({
      where: userIds.map((userId) => ({ groupId, userId })),
    });
  }

  async findPendingInvitations(userId: string): Promise<GroupMember[]> {
    return this.memberRepo.find({
      where: { userId, status: MemberStatus.PENDING },
      relations: ["group", "group.createdBy", "invitedBy"],
    });
  }

  createMembership(data: Partial<GroupMember>): GroupMember {
    return this.memberRepo.create(data);
  }

  async saveMemberships(members: GroupMember[]): Promise<GroupMember[]> {
    if (members.length === 0) return [];
    return this.memberRepo.save(members);
  }

  async saveMembership(member: GroupMember): Promise<GroupMember> {
    return this.memberRepo.save(member);
  }

  /**
   * PENDING → ACTIVE nguyên tử + tăng member_count trong cùng transaction.
   * Điều kiện `status = 'pending'` nằm trong chính câu UPDATE nên 2 request
   * accept đồng thời (double-click) chỉ có 1 request thắng; trước đây cả hai
   * cùng qua bước check trong JS rồi cùng +1 member_count.
   * @returns false nếu lời mời không còn ở trạng thái PENDING.
   */
  async activatePendingMember(
    userId: string,
    groupId: string
  ): Promise<boolean> {
    return AppDataSource.transaction(async (manager) => {
      const res = await manager
        .createQueryBuilder()
        .update(GroupMember)
        .set({ status: MemberStatus.ACTIVE, respondedAt: new Date() })
        .where("group_id = :groupId AND user_id = :userId AND status = :st", {
          groupId,
          userId,
          st: MemberStatus.PENDING,
        })
        .execute();
      if (!res.affected) return false;

      await manager
        .createQueryBuilder()
        .update(Group)
        .set({ memberCount: () => "member_count + 1" })
        .where("id = :groupId", { groupId })
        .execute();
      return true;
    });
  }

  /** PENDING → REJECTED nguyên tử. @returns false nếu không còn PENDING. */
  async rejectPendingMember(userId: string, groupId: string): Promise<boolean> {
    const res = await this.memberRepo
      .createQueryBuilder()
      .update(GroupMember)
      .set({ status: MemberStatus.REJECTED, respondedAt: new Date() })
      .where("group_id = :groupId AND user_id = :userId AND status = :st", {
        groupId,
        userId,
        st: MemberStatus.PENDING,
      })
      .execute();
    return !!res.affected;
  }

  /**
   * ACTIVE → LEFT/KICKED nguyên tử + giảm member_count cùng transaction
   * (cùng lý do với activatePendingMember).
   * @returns false nếu user không còn là member ACTIVE.
   */
  async deactivateActiveMember(
    userId: string,
    groupId: string,
    status: ExitStatus
  ): Promise<boolean> {
    return AppDataSource.transaction(async (manager) => {
      const res = await manager
        .createQueryBuilder()
        .update(GroupMember)
        .set({ status })
        .where("group_id = :groupId AND user_id = :userId AND status = :st", {
          groupId,
          userId,
          st: MemberStatus.ACTIVE,
        })
        .execute();
      if (!res.affected) return false;

      await manager
        .createQueryBuilder()
        .update(Group)
        .set({ memberCount: () => "GREATEST(member_count - 1, 0)" })
        .where("id = :groupId", { groupId })
        .execute();
      return true;
    });
  }

  async promoteToAdmin(userId: string, groupId: string): Promise<boolean> {
    const res = await this.memberRepo.update(
      { userId, groupId, status: MemberStatus.ACTIVE },
      { role: GroupRole.ADMIN }
    );
    return !!res.affected;
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  /**
   * Tin nhắn của group, mới nhất trước, phân trang. `search` lọc theo nội dung
   * (ILIKE, đã escape wildcard). Chỉ select field user cần cho DTO thay vì cả
   * row user của sender / người được reply.
   */
  async findMessagesPage(
    groupId: string,
    skip: number,
    limit: number,
    search?: string
  ): Promise<[GroupMessage[], number]> {
    const qb = this.messageRepo
      .createQueryBuilder("msg")
      .leftJoin("msg.sender", "sender")
      .leftJoin("msg.replyTo", "replyTo")
      .leftJoin("replyTo.sender", "replySender")
      .leftJoinAndSelect("msg.seenBy", "seenBy")
      .addSelect([
        "sender.id",
        "sender.name",
        "sender.avatar",
        "replyTo.id",
        "replyTo.content",
        "replyTo.senderId",
        "replyTo.isDeleted",
        "replySender.id",
        "replySender.name",
      ])
      .where("msg.groupId = :groupId AND msg.isDeleted = false", { groupId })
      .orderBy("msg.createdAt", "DESC")
      .addOrderBy("msg.id", "DESC") // tie-break: phân trang ổn định khi trùng timestamp
      .skip(skip)
      .take(limit);

    if (search?.trim()) {
      qb.andWhere("msg.content ILIKE :search", {
        search: containsPattern(search),
      });
    }
    return qb.getManyAndCount();
  }

  /** Tin được reply (cùng group, chưa xoá) kèm tên người gửi. */
  async findReplyTarget(
    groupId: string,
    messageId: string
  ): Promise<GroupMessage | null> {
    return this.messageRepo
      .createQueryBuilder("msg")
      .leftJoin("msg.sender", "sender")
      .addSelect(["sender.id", "sender.name"])
      .where(
        "msg.id = :messageId AND msg.groupId = :groupId AND msg.isDeleted = false",
        { messageId, groupId }
      )
      .getOne();
  }

  async findActiveMessage(
    groupId: string,
    messageId: string
  ): Promise<GroupMessage | null> {
    return this.messageRepo.findOne({
      where: { id: messageId, groupId, isDeleted: false },
    });
  }

  async findLatestVisibleMessage(
    groupId: string
  ): Promise<GroupMessage | null> {
    return this.messageRepo.findOne({
      where: { groupId, isDeleted: false },
      order: { createdAt: "DESC", id: "DESC" },
    });
  }

  /**
   * Lưu tin nhắn + toàn bộ hệ quả DB (last_message, unread của người khác,
   * seen của người gửi) + ghi event outbox trong CÙNG 1 transaction.
   *
   * - Trước đây các bước này là các lệnh rời rạc: crash giữa chừng để lại tin
   *   đã lưu nhưng không tăng unread / không publish realtime.
   * - `buildEvent` nhận tin vừa lưu (đã có id/createdAt) để dựng payload; nếu
   *   trả null thì không ghi outbox.
   */
  async createMessageWithEffects(
    data: NewMessageData,
    lastMessagePreview: string | null,
    buildEvent: (
      message: GroupMessage
    ) => { topic: string; payload: unknown } | null
  ): Promise<GroupMessage> {
    return AppDataSource.transaction(async (manager) => {
      const message = await manager.save(manager.create(GroupMessage, data));

      await manager
        .createQueryBuilder()
        .update(Group)
        .set({
          lastMessage: lastMessagePreview,
          lastMessageSenderId: data.senderId,
          lastMessageAt: message.createdAt,
        })
        .where(
          "id = :groupId AND (last_message_at IS NULL OR last_message_at <= :at)",
          { groupId: data.groupId, at: message.createdAt }
        )
        .execute();

      await manager
        .createQueryBuilder()
        .update(GroupMember)
        .set({ unreadCount: () => "unread_count + 1" })
        .where(
          "group_id = :groupId AND user_id != :senderId AND status = :status",
          {
            groupId: data.groupId,
            senderId: data.senderId,
            status: MemberStatus.ACTIVE,
          }
        )
        .execute();

      await manager.query(
        `
        INSERT INTO group_message_seen (message_id, user_id, group_id, seen_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (message_id, user_id) DO NOTHING
        `,
        [message.id, data.senderId, data.groupId]
      );

      const event = buildEvent(message);
      if (event)
        await outboxRepository.enqueue(manager, event.topic, event.payload);

      return message;
    });
  }

  async markMessageDeleted(messageId: string): Promise<void> {
    await this.messageRepo.update(messageId, { isDeleted: true });
  }

  // ─── last message / unread / seen ─────────────────────────────────────────

  /** Ghi đè last_message bằng tin còn hiển thị mới nhất (sau khi xoá tin). */
  async setLastMessage(
    groupId: string,
    previous: GroupMessage | null
  ): Promise<void> {
    await this.groupRepo.update(groupId, {
      lastMessage: previous
        ? previous.type === MessageType.TEXT
          ? previous.content
          : `[${previous.type}]`
        : null,
      lastMessageAt: previous?.createdAt ?? null,
      lastMessageSenderId: previous?.senderId ?? null,
    });
  }

  /**
   * Reset unread + đánh dấu seen tất cả tin chưa đọc, trong 1 transaction.
   * @returns danh sách sender_id có tin vừa được đánh dấu seen (để notify).
   */
  async markAllSeen(userId: string, groupId: string): Promise<string[]> {
    return AppDataSource.transaction(async (manager) => {
      await manager.update(
        GroupMember,
        { userId, groupId },
        { unreadCount: 0, lastReadAt: new Date() }
      );

      const rows: Array<{ sender_id: string }> = await manager.query(
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
      return rows.map((r) => r.sender_id);
    });
  }
}

export const groupChatRepository = new GroupChatRepository();
