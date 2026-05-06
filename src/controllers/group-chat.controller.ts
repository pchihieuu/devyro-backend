import { Request, Response, NextFunction } from "express";
import { groupChatService } from "../services/group-chat.service";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

export const uploadMiddleware = upload.single("file");

export class GroupChatController {
  async createGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { name, description, memberIds } = req.body;

      const group = await groupChatService.createGroup(userId, {
        name,
        description,
        memberIds: memberIds || [],
      });

      res.status(201).json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  }

  async updateGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description, avatar } = req.body;
      const group = await groupChatService.updateGroup(
        req.user!.id,
        req.params.groupId,
        { name, description, avatar }
      );
      res.json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  }

  async getUserGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const groups = await groupChatService.getUserGroups(req.user!.id);
      res.json({ success: true, data: groups });
    } catch (error) {
      next(error);
    }
  }

  async getGroupDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const group = await groupChatService.getGroupDetails(
        req.user!.id,
        req.params.groupId
      );
      res.json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  }

  async getPendingInvitations(req: Request, res: Response, next: NextFunction) {
    try {
      const invitations = await groupChatService.getPendingInvitations(
        req.user!.id
      );
      res.json({ success: true, data: invitations });
    } catch (error) {
      next(error);
    }
  }

  async acceptInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      await groupChatService.acceptInvitation(req.user!.id, req.params.groupId);
      res.json({
        success: true,
        message: "Invitation accepted. You have joined the group.",
      });
    } catch (error) {
      next(error);
    }
  }

  async rejectInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      await groupChatService.rejectInvitation(req.user!.id, req.params.groupId);
      res.json({ success: true, message: "Invitation rejected." });
    } catch (error) {
      next(error);
    }
  }

  async getGroupMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await groupChatService.getGroupMessages(
        req.user!.id,
        req.params.groupId,
        page,
        limit
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async sendGroupMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        content,
        type,
        fileUrl,
        filePublicId,
        fileName,
        fileSize,
        fileMimeType,
        replyToId,
      } = req.body;

      const message = await groupChatService.sendGroupMessage(
        req.user!.id,
        req.params.groupId,
        {
          content,
          type,
          fileUrl,
          filePublicId,
          fileName,
          fileSize: fileSize ? parseInt(fileSize) : undefined,
          fileMimeType,
          replyToId,
        }
      );
      res.status(201).json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  }

  async deleteGroupMessage(req: Request, res: Response, next: NextFunction) {
    try {
      await groupChatService.deleteGroupMessage(
        req.user!.id,
        req.params.groupId,
        req.params.messageId
      );
      res.json({ success: true, message: "Message deleted" });
    } catch (error) {
      next(error);
    }
  }

  async uploadMedia(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new Error("No file uploaded");

      const media = await groupChatService.uploadGroupMedia(
        req.user!.id,
        req.params.groupId,
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
        req.file.size
      );

      res.json({ success: true, data: media });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      await groupChatService.markGroupAsRead(req.user!.id, req.params.groupId);
      res.json({ success: true, message: "Marked as read" });
    } catch (error) {
      next(error);
    }
  }

  async addMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const { userIds } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "userIds must be a non-empty array",
          },
        });
      }

      const result = await groupChatService.addMembers(
        req.user!.id,
        req.params.groupId,
        userIds
      );

      const { invited, skipped } = result;
      let message: string;
      if (invited.length > 0 && skipped.length === 0) {
        message = `Đã gửi lời mời đến ${invited.length} thành viên`;
      } else if (invited.length > 0 && skipped.length > 0) {
        message = `Đã gửi lời mời đến ${invited.length} thành viên. ${skipped.length} người đã ở trong nhóm hoặc đã có lời mời.`;
      } else {
        message = "Tất cả người dùng đã ở trong nhóm hoặc đã có lời mời chờ xử lý.";
      }

      res.json({ success: true, data: result, message });
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req: Request, res: Response, next: NextFunction) {
    try {
      await groupChatService.removeMember(
        req.user!.id,
        req.params.groupId,
        req.params.targetUserId
      );
      res.json({ success: true, message: "Member removed" });
    } catch (error) {
      next(error);
    }
  }

  async promoteMember(req: Request, res: Response, next: NextFunction) {
    try {
      await groupChatService.promoteMember(
        req.user!.id,
        req.params.groupId,
        req.params.targetUserId
      );
      res.json({ success: true, message: "Member promoted to admin" });
    } catch (error) {
      next(error);
    }
  }

  async leaveGroup(req: Request, res: Response, next: NextFunction) {
    try {
      await groupChatService.removeMember(
        req.user!.id,
        req.params.groupId,
        req.user!.id
      );
      res.json({ success: true, message: "You have left the group" });
    } catch (error) {
      next(error);
    }
  }
}

export const groupChatController = new GroupChatController();