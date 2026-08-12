import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../controllers/notification.controller";
import { ROUTES } from "../constants/routes";
import {
  getNotificationsSchema,
  notificationIdSchema,
} from "../validators/notification.validator";
import { validate } from "../middlewares/validation.middleware";

const router = Router();
router.use(protect);

router.get(ROUTES.NOTIFICATIONS.UNREAD_COUNT, getUnreadCount);
router.put(ROUTES.NOTIFICATIONS.MARK_ALL_READ, markAllAsRead);
router.get(
  ROUTES.NOTIFICATIONS.LIST,
  validate(getNotificationsSchema),
  getMyNotifications
);
router.put(
  ROUTES.NOTIFICATIONS.MARK_READ,
  validate(notificationIdSchema),
  markAsRead
);

router.delete(
  ROUTES.NOTIFICATIONS.BY_ID,
  validate(notificationIdSchema),
  deleteNotification
);

export default router;
