import { isUniqueViolation } from "../utils/db-error.util";
import { AppDataSource } from "../config/database.config";
import { Conversation } from "../entities/Conversation.entity";

/** Postgres unique_violation error code */

export class ConversationRepository {
  private repo = AppDataSource.getRepository(Conversation);

  /**
   * Chuẩn hoá thứ tự cặp user: user1Id luôn là UUID nhỏ hơn (string compare).
   * Bắt buộc dùng hàm này ở MỌI nơi đọc/ghi theo cặp (userId1, userId2),
   * để khớp với unique index (user1Id, user2Id) trên entity — nếu không
   * chuẩn hoá, 2 chiều (A,B) và (B,A) sẽ bị coi là 2 record khác nhau và
   * unique index không chặn được conversation trùng.
   */
  private normalizeUserPair(userId1: string, userId2: string): [string, string] {
    return userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
  }

  // ---- write ops ----

  async remove(conversation: Conversation): Promise<void> {
    await this.repo.remove(conversation);
  }

  async save(conversation: Conversation): Promise<Conversation> {
    return this.repo.save(conversation);
  }

  /**
   * Tìm conversation giữa 2 user nếu đã có, không thì tạo mới.
   * Atomic trước race condition: nếu 2 request tạo cùng lúc (vd A gửi cho B
   * và B gửi cho A gần như đồng thời), insert thứ 2 sẽ vi phạm unique index
   * (user1Id, user2Id) — thay vì để lỗi văng ra, bắt lỗi 23505 rồi đọc lại
   * record vừa được request kia tạo.
   */
  async findOrCreateConversation(
    userId1: string,
    userId2: string
  ): Promise<Conversation> {
    const [user1Id, user2Id] = this.normalizeUserPair(userId1, userId2);

    const existing = await this.repo.findOne({ where: { user1Id, user2Id } });
    if (existing) return existing;

    try {
      return await this.repo.save(this.repo.create({ user1Id, user2Id }));
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        const conversation = await this.repo.findOne({
          where: { user1Id, user2Id },
        });
        if (conversation) return conversation;
      }
      throw error;
    }
  }

  // ---- single-record reads ----

  /** Tìm conversation giữa 2 user, không quan tâm ai truyền vào trước */
  async findByUsers(
    userId1: string,
    userId2: string
  ): Promise<Conversation | null> {
    const [user1Id, user2Id] = this.normalizeUserPair(userId1, userId2);
    return this.repo.findOne({ where: { user1Id, user2Id } });
  }

  // ---- list reads ----

  /** Dùng cho getConversations - cần user1/user2 để hiển thị otherUser */
  async findAllForUser(userId: string): Promise<Conversation[]> {
    return this.repo.find({
      where: [{ user1Id: userId }, { user2Id: userId }],
      relations: ["user1", "user2"],
      order: { lastMessageAt: "DESC" },
    });
  }

  /** Dùng cho getUnreadCount - chỉ cần unreadCount, không load relations */
  async findAllForUnreadCount(userId: string): Promise<Conversation[]> {
    return this.repo.find({
      where: [{ user1Id: userId }, { user2Id: userId }],
    });
  }
}

export const conversationRepository = new ConversationRepository();