import { AppDataSource } from "../config/database.config";
import {
  Notification,
  NotificationType,
} from "../entities/Notification.entity";
import { getWebSocketService } from "./websocket.service";
import { NotFoundError } from "../utils/errors";
import {
  CreateNotificationData,
  GetMyNotificationsResult,
  NotificationWSPayload,
} from "../types/notification.types";
import {
  buildPaginatedResult,
  getSkip,
  PaginatedResult,
} from "../utils/pagination.util";

export class NotificationService {
  private notificationRepository = AppDataSource.getRepository(Notification);

  async createNotification(
    data: CreateNotificationData
  ): Promise<Notification> {
    const notification = this.notificationRepository.create(data);
    const savedNotification =
      await this.notificationRepository.save(notification);

    try {
      const wsService = getWebSocketService();
      const wsPayload: NotificationWSPayload = {
        id: savedNotification.id,
        title: savedNotification.title,
        message: savedNotification.message,
        type: savedNotification.type,
        metadata: savedNotification.metadata,
        createdAt: savedNotification.createdAt,
      };
      wsService.sendNotificationToUser(data.userId, wsPayload);
    } catch (error) {
      console.error("Failed to send WebSocket notification:", error);
    }

    return savedNotification;
  }

  async getMyNotifications(
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResult<Notification> & { unreadCount: number }> {
    const skip = getSkip(page, limit);

    const [notifications, total] =
      await this.notificationRepository.findAndCount({
        where: { userId },
        order: { createdAt: "DESC" },
        take: limit,
        skip,
      });

    const unreadCount = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });

    return {
      ...buildPaginatedResult(notifications, total, page, limit),
      unreadCount,
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.findOwnedOrThrow(notificationId, userId);

    notification.isRead = true;
    await this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true }
    );
  }

  async deleteNotification(
    notificationId: string,
    userId: string
  ): Promise<void> {
    const notification = await this.findOwnedOrThrow(notificationId, userId);

    await this.notificationRepository.remove(notification);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async notifyApplicationStatusChanged(
    applicantId: string,
    applicationId: string,
    jobId: string,
    jobTitle: string,
    companyName: string,
    newStatus: string
  ): Promise<void> {
    const statusMessages: Record<string, string> = {
      "In Review": "is now being reviewed",
      Accepted: "has been accepted!",
      Rejected: "was not successful this time",
    };

    await this.createNotification({
      userId: applicantId,
      title: "Application Status Updated",
      message: `Your application for ${jobTitle} at ${companyName} ${statusMessages[newStatus] || "has been updated"}.`,
      type: NotificationType.APPLICATION_STATUS_UPDATED,
      metadata: {
        applicationId,
        jobId,
        jobTitle,
        companyName,
        status: newStatus,
      },
    });
  }

  async notifyEmployerNewApplication(
    employerId: string,
    applicationId: string,
    jobId: string,
    jobTitle: string,
    applicantName: string
  ): Promise<void> {
    await this.createNotification({
      userId: employerId,
      title: "New Application Received",
      message: `${applicantName} has applied for ${jobTitle}.`,
      type: NotificationType.JOB_APPLIED,
      metadata: { applicationId, jobId, jobTitle, applicantName },
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  /**
   * Dùng chung cho markAsRead/deleteNotification — cả hai đều cần
   * tìm notification theo {id, userId} rồi throw NotFoundError nếu
   * không thuộc user hoặc không tồn tại.
   */
  private async findOwnedOrThrow(
    notificationId: string,
    userId: string
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundError("Notification not found");
    }

    return notification;
  }
}

export const notificationService = new NotificationService();
