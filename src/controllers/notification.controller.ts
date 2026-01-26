import { Request, Response } from "express";
import { notificationService } from "../services/notification.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HTTP_STATUS } from "../constants/httpStatus";

export const getMyNotifications = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await notificationService.getMyNotifications(
      req.user!.id,
      limit,
      offset
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: result.notifications,
      meta: {
        total: result.total,
        unreadCount: result.unreadCount,
        limit,
        offset,
      },
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