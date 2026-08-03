import { Router } from "express";
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
import { deleteConversation, deleteMessage, getConversations, getMessages, getUnreadCount, markAsRead, sendMessage, startConversation } from "../controllers/chat.controller";

const router = Router();

router.get(ROUTES.CHAT.CONVERSATIONS, protect, getConversations);

router.post(
  ROUTES.CHAT.START_CONVERSATION,
  protect,
  validate(startConversationSchema),
  startConversation
);

router.get(ROUTES.CHAT.UNREAD_COUNT, protect, getUnreadCount);

router.get(
  ROUTES.CHAT.GET_MESSAGES,
  protect,
  validate(getMessagesSchema),
  getMessages
);

router.post(
  ROUTES.CHAT.MESSAGES,
  protect,
  validate(sendMessageSchema),
  sendMessage
);

router.put(
  ROUTES.CHAT.MARK_AS_READ,
  protect,
  validate(markAsReadSchema),
  markAsRead
);

router.delete(
  ROUTES.CHAT.DELETE_MESSAGE,
  protect,
  validate(deleteMessageSchema),
  deleteMessage
);

// Delete entire conversation (must be after other routes to avoid conflicts)
router.delete(
  ROUTES.CHAT.DELETE_CONVERSATION,
  protect,
  validate(deleteConversationSchema),
  deleteConversation
);

export default router;
