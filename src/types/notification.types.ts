import { z } from "zod";
import { NotificationType } from "../entities/Notification.entity";

export interface CreateNotificationData {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  metadata?: NotificationMetadata;
}

export interface ApplicationStatusMetadata {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  status: string;
}

export interface JobAppliedMetadata {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  applicantName: string;
}

export type NotificationMetadata =
  | ApplicationStatusMetadata
  | JobAppliedMetadata
  | Record<string, unknown>;

export interface GetMyNotificationsResult {
  notifications: NotificationDTO[];
  total: number;
  unreadCount: number;
}

export const notificationDTOSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  message: z.string(),
  type: z.nativeEnum(NotificationType),
  metadata: z.custom<NotificationMetadata>().optional().nullable(),
  isRead: z.boolean(),
  createdAt: z.date(),
});

export type NotificationDTO = z.infer<typeof notificationDTOSchema>;

export interface NotificationWSPayload {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  metadata?: NotificationMetadata;
  createdAt: Date;
}
