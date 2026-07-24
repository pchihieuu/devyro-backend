import { Request, Response } from "express";
import { notificationService } from "../services/notification.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HTTP_STATUS } from "../constants/httpStatus";
import { buildPaginationMeta } from "../utils/pagination.util";

export const getMyNotifications = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

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
  }
);

export const getUnreadCount = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const count = await notificationService.getUnreadCount(req.user!.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { count },
    });
  }
);

export const markAsRead = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await notificationService.markAsRead(req.params.id, req.user!.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Notification marked as read",
    });
  }
);

export const markAllAsRead = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await notificationService.markAllAsRead(req.user!.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "All notifications marked as read",
    });
  }
);

export const deleteNotification = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await notificationService.deleteNotification(req.params.id, req.user!.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Notification deleted successfully",
    });
  }
);
