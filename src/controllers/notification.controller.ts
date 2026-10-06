import { Response } from "express";
import { notificationService } from "../services/notification.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/api-response";

import {
  GetNotificationsQuery,
  NotificationIdParams,
} from "../validators/notification.validator";
import { ValidatedRequest } from "../types/express";

export const getMyNotifications = asyncHandler<
  ValidatedRequest<Record<string, never>, GetNotificationsQuery, undefined>
>(async (req, res: Response): Promise<void> => {
  const { page, limit } = req.validatedQuery;

  const result = await notificationService.getMyNotifications(
    req.user!.id,
    page,
    limit
  );

  ApiResponse.paginated(res, result, {
    message: "Notifications retrieved successfully",
    meta: { unreadCount: result.unreadCount },
  });
});

export const getUnreadCount = asyncHandler(
  async (req, res: Response): Promise<void> => {
    const count = await notificationService.getUnreadCount(req.user!.id);
    ApiResponse.ok(res, { count });
  }
);

export const markAsRead = asyncHandler<
  ValidatedRequest<NotificationIdParams, Record<string, never>, undefined>
>(async (req, res: Response): Promise<void> => {
  await notificationService.markAsRead(req.validatedParams.id, req.user!.id);
  ApiResponse.message(res, "Notification marked as read");
});

export const markAllAsRead = asyncHandler(
  async (req, res: Response): Promise<void> => {
    await notificationService.markAllAsRead(req.user!.id);
    ApiResponse.message(res, "All notifications marked as read");
  }
);

export const deleteNotification = asyncHandler<
  ValidatedRequest<NotificationIdParams, Record<string, never>, undefined>
>(async (req, res: Response): Promise<void> => {
  await notificationService.deleteNotification(
    req.validatedParams.id,
    req.user!.id
  );
  ApiResponse.message(res, "Notification deleted successfully");
});
