import { Request, Response, NextFunction } from "express";
import { chatService } from "../services/chat.service";

export class ChatController {
  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { receiverId, content, type, fileUrl } = req.body;

      const message = await chatService.sendMessage(userId, {
        receiverId,
        content,
        type,
        fileUrl,
      });

      res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { otherUserId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await chatService.getMessages(
        userId,
        otherUserId,
        page,
        limit
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getConversations(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const conversations = await chatService.getConversations(userId);

      res.json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { otherUserId } = req.params;

      await chatService.markAsRead(userId, otherUserId);

      res.json({
        success: true,
        message: "Messages marked as read",
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { messageId } = req.params;

      await chatService.deleteMessage(messageId, userId);

      res.json({
        success: true,
        message: "Message deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const count = await chatService.getUnreadCount(userId);

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  }
  async startConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { otherUserId } = req.body;

      const conversation = await chatService.startConversation(
        userId,
        otherUserId
      );

      res.status(201).json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { otherUserId } = req.params;

      await chatService.deleteConversation(userId, otherUserId);

      res.json({
        success: true,
        message: "Conversation deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}

export const chatController = new ChatController();
