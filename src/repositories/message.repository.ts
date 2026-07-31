import { AppDataSource } from "../config/database.config";
import { Message } from "../entities/Message.entity";
import { getSkip } from "../utils/pagination.util";

export class MessageRepository {
  private repo = AppDataSource.getRepository(Message);

  // ---- write ops ----

  create(data: Partial<Message>): Message {
    return this.repo.create(data);
  }

  async save(message: Message): Promise<Message> {
    return this.repo.save(message);
  }

  async remove(message: Message): Promise<void> {
    await this.repo.remove(message);
  }

  /** Xoá toàn bộ tin nhắn giữa 2 user - dùng khi deleteConversation */
  async deleteBetweenUsers(userId1: string, userId2: string): Promise<void> {
    await this.repo.delete([
      { senderId: userId1, receiverId: userId2 },
      { senderId: userId2, receiverId: userId1 },
    ]);
  }

  /** Đánh dấu đã đọc các tin nhắn senderId gửi cho receiverId */
  async markAsReadBetweenUsers(
    receiverId: string,
    senderId: string
  ): Promise<void> {
    await this.repo.update(
      { senderId, receiverId, isRead: false },
      { isRead: true }
    );
  }

  // ---- single-record reads ----

  async findById(messageId: string): Promise<Message | null> {
    return this.repo.findOne({ where: { id: messageId } });
  }

  async findLatestBetweenUsers(
    userId1: string,
    userId2: string
  ): Promise<Message | null> {
    return this.repo.findOne({
      where: [
        { senderId: userId1, receiverId: userId2 },
        { senderId: userId2, receiverId: userId1 },
      ],
      order: { createdAt: "DESC" },
    });
  }
  // ---- list reads ----

  /** Tin nhắn giữa 2 user, mới nhất trước (phân trang), kèm sender/receiver */
  async findAndCountBetweenUsers(
    userId: string,
    otherUserId: string,
    page: number,
    limit: number
  ): Promise<[Message[], number]> {
    return this.repo.findAndCount({
      where: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
      relations: ["sender", "receiver"],
      order: { createdAt: "DESC" },
      take: limit,
      skip: getSkip(page, limit),
    });
  }
}

export const messageRepository = new MessageRepository();
