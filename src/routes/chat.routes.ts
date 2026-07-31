import { Router } from "express";
import * as chatController from "../controllers/chat.controller";
import { protect } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  getMessagesSchema,
  markAsReadSchema,
  deleteMessageSchema,
  deleteConversationSchema,
  sendMessageSchema,
  startConversationSchema,
} from "../validators/chat.validator";
import { ROUTES } from "../constants/routes";

const router = Router();

router.get(ROUTES.CHAT.CONVERSATIONS, protect, chatController.getConversations);

router.post(
  ROUTES.CHAT.START_CONVERSATION,
  protect,
  validate(startConversationSchema),
  chatController.startConversation
);

router.get(ROUTES.CHAT.UNREAD_COUNT, protect, chatController.getUnreadCount);

router.get(
  ROUTES.CHAT.GET_MESSAGES,
  protect,
  validate(getMessagesSchema),
  chatController.getMessages
);

router.post(
  ROUTES.CHAT.MESSAGES,
  protect,
  validate(sendMessageSchema),
  chatController.sendMessage
);

router.put(
  ROUTES.CHAT.MARK_AS_READ,
  protect,
  validate(markAsReadSchema),
  chatController.markAsRead
);

router.delete(
  ROUTES.CHAT.DELETE_MESSAGE,
  protect,
  validate(deleteMessageSchema),
  chatController.deleteMessage
);

// Delete entire conversation (must be after other routes to avoid conflicts)
router.delete(
  ROUTES.CHAT.DELETE_CONVERSATION,
  protect,
  validate(deleteConversationSchema),
  chatController.deleteConversation
);

export default router;
