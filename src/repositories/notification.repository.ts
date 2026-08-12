import { AppDataSource } from "../config/database.config";
import { Notification } from "../entities/Notification.entity";
import { CreateNotificationData } from "../types/notification.types";

export class NotificationRepository {
  private repo = AppDataSource.getRepository(Notification);

  /** Tạo + lưu notification mới. Không lo việc gửi WS — đó là việc của service. */
  create(data: CreateNotificationData): Promise<Notification> {
    const notification = this.repo.create({
      ...data,
      metadata: data.metadata ?? null, // nếu undefined thì lưu null vào DB (cột JSON nullable)
    });
    return this.repo.save(notification);
  }

  /** Danh sách notification của 1 user, mới nhất trước, có phân trang. */
  findManyByUser(
    userId: string,
    skip: number,
    limit: number
  ): Promise<[Notification[], number]> {
    return this.repo.findAndCount({
      where: { userId },
      order: { createdAt: "DESC" },
      take: limit,
      skip,
    });
  }

  /** Đếm noti chưa đọc — dùng cho badge count và cho unreadCount trong list. */
  countUnread(userId: string): Promise<number> {
    return this.repo.count({ where: { userId, isRead: false } });
  }

  /**
   * Tìm theo id VÀ userId cùng lúc (không tách 2 bước) để tránh lộ việc noti
   * có tồn tại hay không cho user khác — không khớp thì trả null, service throw
   * NotFoundError chung chung.
   */
  findByIdAndUser(id: string, userId: string): Promise<Notification | null> {
    return this.repo.findOne({ where: { id, userId } });
  }

  save(notification: Notification): Promise<Notification> {
    return this.repo.save(notification);
  }

  async remove(notification: Notification): Promise<void> {
    await this.repo.remove(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.repo.update({ userId, isRead: false }, { isRead: true });
  }
}

export const notificationRepository = new NotificationRepository();
