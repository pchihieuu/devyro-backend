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

const router = Router();
router.use(protect);
// All routes are protected
router.get("/", getMyNotifications);
router.get(ROUTES.NOTIFICATIONS.UNREAD_COUNT, getUnreadCount);
router.put(ROUTES.NOTIFICATIONS.MARK_ALL_READ, markAllAsRead);
router.put(ROUTES.NOTIFICATIONS.MARK_READ, markAsRead);

router.delete(ROUTES.NOTIFICATIONS.BY_ID, deleteNotification);

export default router;
