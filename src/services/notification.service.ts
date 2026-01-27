import { AppDataSource } from "../config/database.config";
import {
  Notification,
  NotificationType,
} from "../entities/Notification.entity";
import { getWebSocketService } from "./websocket.service";
import { NotFoundError } from "../utils/errors";

export class NotificationService {
  private notificationRepository = AppDataSource.getRepository(Notification);

  async createNotification(data: {
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    metadata?: any;
  }): Promise<Notification> {
    const notification = this.notificationRepository.create(data);
    const savedNotification =
      await this.notificationRepository.save(notification);

    // Send real-time notification via WebSocket
    try {
      const wsService = getWebSocketService();
      wsService.sendNotificationToUser(data.userId, {
        id: savedNotification.id,
        title: savedNotification.title,
        message: savedNotification.message,
        type: savedNotification.type,
        metadata: savedNotification.metadata,
        createdAt: savedNotification.createdAt,
      });
    } catch (error) {
      console.error("Failed to send WebSocket notification:", error);
    }

    return savedNotification;
  }

  async getMyNotifications(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    notifications: Notification[];
    total: number;
    unreadCount: number;
  }> {
    const [notifications, total] =
      await this.notificationRepository.findAndCount({
        where: { userId },
        order: { createdAt: "DESC" },
        take: limit,
        skip: offset,
      });

    const unreadCount = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });

    return { notifications, total, unreadCount };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundError("Notification not found");
    }

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
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundError("Notification not found");
    }

    await this.notificationRepository.remove(notification);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  // Helper methods for specific notification types
  // Added jobId parameter
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
      Accepted: "has been accepted! 🎉",
      Rejected: "was not successful this time",
    };

    await this.createNotification({
      userId: applicantId,
      title: "Application Status Updated",
      message: `Your application for ${jobTitle} at ${companyName} ${statusMessages[newStatus] || "has been updated"}.`,
      type: NotificationType.APPLICATION_STATUS_UPDATED,
      metadata: {
        applicationId,
        jobId, // Include jobId in metadata for navigation
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
      metadata: {
        applicationId,
        jobId,
        jobTitle,
        applicantName,
      },
    });
  }
}

export const notificationService = new NotificationService();
