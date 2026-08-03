import { Response } from "express";
import { chatService } from "../services/chat.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HTTP_STATUS, HTTP_MESSAGE } from "../constants/httpStatus";
import { ValidatedRequest } from "../types/express";
import {
  DeleteConversationParams,
  DeleteMessageParams,
  GetMessagesParams,
  GetMessagesQuery,
  MarkAsReadParams,
  SendMessageBody,
  StartConversationBody,
} from "../validators/chat.validator";

export const sendMessage = asyncHandler<
  ValidatedRequest<{}, {}, SendMessageBody>
>(async (req, res: Response): Promise<void> => {
  const { receiverId, content, type, fileUrl } = req.body;

  const message = await chatService.sendMessage(req.user!.id, {
    receiverId,
    content,
    type,
    fileUrl,
  });

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    data: message,
  });
});

export const getMessages = asyncHandler<
  ValidatedRequest<GetMessagesParams, GetMessagesQuery>
>(async (req, res: Response): Promise<void> => {
  const { otherUserId } = req.validatedParams;
  const { page, limit } = req.validatedQuery;

  const result = await chatService.getMessages(
    req.user!.id,
    otherUserId,
    page,
    limit
  );

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: result,
  });
});

export const getConversations = asyncHandler(
  async (req, res: Response): Promise<void> => {
    const conversations = await chatService.getConversations(req.user!.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: conversations,
    });
  }
);

export const markAsRead = asyncHandler<ValidatedRequest<MarkAsReadParams>>(
  async (req, res: Response): Promise<void> => {
    const { otherUserId } = req.validatedParams;

    await chatService.markAsRead(req.user!.id, otherUserId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: HTTP_MESSAGE.UPDATED,
    });
  }
);

export const deleteMessage = asyncHandler<
  ValidatedRequest<DeleteMessageParams>
>(async (req, res: Response): Promise<void> => {
  const { messageId } = req.validatedParams;

  await chatService.deleteMessage(messageId, req.user!.id);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: HTTP_MESSAGE.DELETED,
  });
});

export const getUnreadCount = asyncHandler(
  async (req, res: Response): Promise<void> => {
    const count = await chatService.getUnreadCount(req.user!.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { count },
    });
  }
);

export const startConversation = asyncHandler<
  ValidatedRequest<{}, {}, StartConversationBody>
>(async (req, res: Response): Promise<void> => {
  const { otherUserId } = req.body;

  const conversation = await chatService.startConversation(
    req.user!.id,
    otherUserId
  );

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    data: conversation,
  });
});

export const deleteConversation = asyncHandler<
  ValidatedRequest<DeleteConversationParams>
>(async (req, res: Response): Promise<void> => {
  const { otherUserId } = req.validatedParams;

  await chatService.deleteConversation(req.user!.id, otherUserId);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: HTTP_MESSAGE.DELETED,
  });
});
