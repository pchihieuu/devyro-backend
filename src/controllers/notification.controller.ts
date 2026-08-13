import { Response } from "express";
import { notificationService } from "../services/notification.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HTTP_STATUS } from "../constants/httpStatus";
import { buildPaginationMeta } from "../utils/pagination.util";

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

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Notifications retrieved successfully",
    data: result.items,
    pagination: buildPaginationMeta(result),
    meta: { unreadCount: result.unreadCount },
  });
});

export const getUnreadCount = asyncHandler(
  async (req, res: Response): Promise<void> => {
    const count = await notificationService.getUnreadCount(req.user!.id);
    res.status(HTTP_STATUS.OK).json({ success: true, data: { count } });
  }
);

export const markAsRead = asyncHandler<
  ValidatedRequest<NotificationIdParams, Record<string, never>, undefined>
>(async (req, res: Response): Promise<void> => {
  await notificationService.markAsRead(req.validatedParams.id, req.user!.id);
  res
    .status(HTTP_STATUS.OK)
    .json({ success: true, message: "Notification marked as read" });
});

export const markAllAsRead = asyncHandler(
  async (req, res: Response): Promise<void> => {
    await notificationService.markAllAsRead(req.user!.id);
    res
      .status(HTTP_STATUS.OK)
      .json({ success: true, message: "All notifications marked as read" });
  }
);

export const deleteNotification = asyncHandler<
  ValidatedRequest<NotificationIdParams, Record<string, never>, undefined>
>(async (req, res: Response): Promise<void> => {
  await notificationService.deleteNotification(
    req.validatedParams.id,
    req.user!.id
  );
  res
    .status(HTTP_STATUS.OK)
    .json({ success: true, message: "Notification deleted successfully" });
});
