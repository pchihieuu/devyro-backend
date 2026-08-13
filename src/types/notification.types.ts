import { z } from "zod";
import {
  Notification,
  NotificationType,
} from "../entities/Notification.entity";
import { PaginatedResult } from "../utils/pagination.util";

export type ApplicationStatusMetadata = {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  status: string;
}

export type JobAppliedMetadata = {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  applicantName: string;
}

export type NotificationMetadata =
  | ApplicationStatusMetadata
  | JobAppliedMetadata
  | Record<string, unknown>;

// Các field scalar (userId, title, message, type) lấy trực tiếp từ entity bằng
// Pick — entity đổi field thì type này tự theo, không có 2 nguồn sự thật.
// Riêng `metadata` override sang NotificationMetadata (chặt hơn Record<string, unknown>
// của entity) để notifyApplicationStatusChanged/notifyEmployerNewApplication được
// TS check đúng shape ngay tại nơi gọi — entity vẫn giữ rộng vì đó là cột JSON,
// không nên ràng buộc theo business logic hiện tại.
export type CreateNotificationData = Pick<
  Notification,
  "userId" | "title" | "message" | "type"
> & {
  metadata?: NotificationMetadata;
};

export type NotificationsListResult = PaginatedResult<Notification> & {
  unreadCount: number;
};

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
