import { Router } from "express";
import { chatController } from "../controllers/chat.controller";
import { protect } from "../middlewares/auth.middleware";
import { ROUTES } from "../constants/routes";

const router = Router();

router.get(ROUTES.CHAT.CONVERSATIONS, protect, chatController.getConversations);

router.post(
  ROUTES.CHAT.START_CONVERSATION,
  protect,
  chatController.startConversation
);

router.get(ROUTES.CHAT.UNREAD_COUNT, protect, chatController.getUnreadCount);

router.get(ROUTES.CHAT.GET_MESSAGES, protect, chatController.getMessages);

router.post(ROUTES.CHAT.MESSAGES, protect, chatController.sendMessage);

router.put(ROUTES.CHAT.MARK_AS_READ, protect, chatController.markAsRead);

router.delete(
  ROUTES.CHAT.DELETE_MESSAGE,
  protect,
  chatController.deleteMessage
);

// Delete entire conversation (must be after other routes to avoid conflicts)
router.delete(
  ROUTES.CHAT.DELETE_CONVERSATION,
  protect,
  chatController.deleteConversation
);

export default router;
