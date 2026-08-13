import {
  Notification,
  NotificationType,
} from "../entities/Notification.entity";
import { getWebSocketService } from "./websocket.service";
import { NotFoundError } from "../utils/errors";
import {
  notificationRepository,
  NotificationRepository,
} from "../repositories/notification.repository";
import {
  CreateNotificationData,
  NotificationsListResult,
  NotificationWSPayload,
} from "../types/notification.types";
import { buildPaginatedResult, getSkip } from "../utils/pagination.util";

export class NotificationService {
  constructor(
    private readonly notificationRepo: NotificationRepository = notificationRepository
  ) {}

  async createNotification(
    data: CreateNotificationData
  ): Promise<Notification> {
    const savedNotification = await this.notificationRepo.create(data);

    try {
      const wsService = getWebSocketService();
      const wsPayload: NotificationWSPayload = {
        id: savedNotification.id,
        title: savedNotification.title,
        message: savedNotification.message,
        type: savedNotification.type,
        metadata: savedNotification.metadata ?? undefined,
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
  ): Promise<NotificationsListResult> {
    const skip = getSkip(page, limit);

    const [notifications, total] = await this.notificationRepo.findManyByUser(
      userId,
      skip,
      limit
    );
    const unreadCount = await this.notificationRepo.countUnread(userId);

    return {
      ...buildPaginatedResult(notifications, total, page, limit),
      unreadCount,
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.getOwnedOrThrow(notificationId, userId);
    notification.isRead = true;
    await this.notificationRepo.save(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo.markAllAsRead(userId);
  }

  async deleteNotification(
    notificationId: string,
    userId: string
  ): Promise<void> {
    const notification = await this.getOwnedOrThrow(notificationId, userId);
    await this.notificationRepo.remove(notification);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.countUnread(userId);
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
      message: `Your application for ${jobTitle} at ${companyName} ${
        statusMessages[newStatus] || "has been updated"
      }.`,
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

  // ─── Helpers ───────────────────────────────────────────
  private async getOwnedOrThrow(
    notificationId: string,
    userId: string
  ): Promise<Notification> {
    const notification = await this.notificationRepo.findByIdAndUser(
      notificationId,
      userId
    );
    if (!notification) {
      throw new NotFoundError("Notification not found");
    }
    return notification;
  }
}

export const notificationService = new NotificationService();
