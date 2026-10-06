import { Response } from "express";
import multer from "multer";
import { groupChatService } from "../services/group-chat.service";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError } from "../utils/errors";
import { ApiResponse } from "../utils/api-response";
import {
  buildPaginatedResult,
  buildPaginationMeta,
} from "../utils/pagination.util";
import { ValidatedRequest } from "../types/express";
import {
  AddMembersBody,
  AddMembersParams,
  CreateGroupBody,
  DeleteGroupMessageParams,
  GetGroupMessagesParams,
  GetGroupMessagesQuery,
  GetUserGroupsQuery,
  GroupIdParams,
  MemberActionParams,
  SendGroupMessageBody,
  SendGroupMessageParams,
  UpdateGroupBody,
  UpdateGroupParams,
} from "../validators/group-chat.validator";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

export const uploadMiddleware = upload.single("file");

/**
 * Rewritten to asyncHandler<ValidatedRequest<...>> to match the rest of the
 * codebase's module pattern (job/application/company controllers): reads
 * come from req.validatedParams/validatedQuery (guaranteed present and
 * typed once group-chat.validator.ts schemas run), business errors are
 * thrown as AppError subclasses and handled by the single shared
 * error.middleware.ts instead of each method hand-rolling its own
 * try/catch(next) and, in one case (addMembers), its own bespoke
 * `{ error: { code, message } }` response shape that didn't match the
 * `{ success, message, errors }` shape every other endpoint returns.
 */
class GroupChatController {
  createGroup = asyncHandler<
    ValidatedRequest<
      Record<string, never>,
      Record<string, never>,
      CreateGroupBody
    >
  >(async (req, res: Response): Promise<void> => {
    const { name, description, memberIds } = req.body;

    const group = await groupChatService.createGroup(req.user!.id, {
      name,
      description,
      memberIds,
    });

    ApiResponse.created(res, group);
  });

  updateGroup = asyncHandler<
    ValidatedRequest<UpdateGroupParams, Record<string, never>, UpdateGroupBody>
  >(async (req, res: Response): Promise<void> => {
    const { name, description, avatar } = req.body;

    const group = await groupChatService.updateGroup(
      req.user!.id,
      req.validatedParams.groupId,
      { name, description, avatar }
    );

    ApiResponse.ok(res, group);
  });

  getUserGroups = asyncHandler<
    ValidatedRequest<Record<string, never>, GetUserGroupsQuery>
  >(async (req, res: Response): Promise<void> => {
    const groups = await groupChatService.getUserGroups(
      req.user!.id,
      req.validatedQuery.search
    );
    ApiResponse.ok(res, groups);
  });

  getGroupDetails = asyncHandler<ValidatedRequest<GroupIdParams>>(
    async (req, res: Response): Promise<void> => {
      const group = await groupChatService.getGroupDetails(
        req.user!.id,
        req.validatedParams.groupId
      );
      ApiResponse.ok(res, group);
    }
  );

  getPendingInvitations = asyncHandler(
    async (req, res: Response): Promise<void> => {
      const invitations = await groupChatService.getPendingInvitations(
        req.user!.id
      );
      ApiResponse.ok(res, invitations);
    }
  );

  acceptInvitation = asyncHandler<ValidatedRequest<GroupIdParams>>(
    async (req, res: Response): Promise<void> => {
      await groupChatService.acceptInvitation(
        req.user!.id,
        req.validatedParams.groupId
      );
      ApiResponse.message(
        res,
        "Invitation accepted. You have joined the group."
      );
    }
  );

  rejectInvitation = asyncHandler<ValidatedRequest<GroupIdParams>>(
    async (req, res: Response): Promise<void> => {
      await groupChatService.rejectInvitation(
        req.user!.id,
        req.validatedParams.groupId
      );
      ApiResponse.message(res, "Invitation rejected.");
    }
  );

  getGroupMessages = asyncHandler<
    ValidatedRequest<GetGroupMessagesParams, GetGroupMessagesQuery>
  >(async (req, res: Response): Promise<void> => {
    const { page, limit, search } = req.validatedQuery;

    const result = await groupChatService.getGroupMessages(
      req.user!.id,
      req.validatedParams.groupId,
      page,
      limit,
      search
    );

    // Tương thích ngược: `data` vẫn là {messages, total, hasMore} như FE đang
    // đọc. Đồng thời trả thêm `pagination` chuẩn (cùng shape mọi list
    // endpoint khác) để FE có thể migrate dần mà KHÔNG cần đổi wire format
    // trong 1 lần. Khi FE đã chuyển xong có thể bỏ `data.total/hasMore`.
    ApiResponse.success(res, {
      data: result,
      pagination: buildPaginationMeta(
        buildPaginatedResult(result.messages, result.total, page, limit)
      ),
    });
  });

  sendGroupMessage = asyncHandler<
    ValidatedRequest<
      SendGroupMessageParams,
      Record<string, never>,
      SendGroupMessageBody
    >
  >(async (req, res: Response): Promise<void> => {
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
      req.validatedParams.groupId,
      {
        content,
        type,
        fileUrl,
        filePublicId,
        fileName,
        fileSize,
        fileMimeType,
        replyToId,
      }
    );

    ApiResponse.created(res, message);
  });

  deleteGroupMessage = asyncHandler<ValidatedRequest<DeleteGroupMessageParams>>(
    async (req, res: Response): Promise<void> => {
      await groupChatService.deleteGroupMessage(
        req.user!.id,
        req.validatedParams.groupId,
        req.validatedParams.messageId
      );
      ApiResponse.message(res, "Message deleted");
    }
  );

  uploadMedia = asyncHandler<ValidatedRequest<GroupIdParams>>(
    async (req, res: Response): Promise<void> => {
      if (!req.file) throw new BadRequestError("No file uploaded");

      const media = await groupChatService.uploadGroupMedia(
        req.user!.id,
        req.validatedParams.groupId,
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
        req.file.size
      );

      ApiResponse.created(res, media);
    }
  );

  markAsRead = asyncHandler<ValidatedRequest<GroupIdParams>>(
    async (req, res: Response): Promise<void> => {
      await groupChatService.markGroupAsRead(
        req.user!.id,
        req.validatedParams.groupId
      );
      ApiResponse.message(res, "Marked as read");
    }
  );

  addMembers = asyncHandler<
    ValidatedRequest<AddMembersParams, Record<string, never>, AddMembersBody>
  >(async (req, res: Response): Promise<void> => {
    const { userIds } = req.body;

    const result = await groupChatService.addMembers(
      req.user!.id,
      req.validatedParams.groupId,
      userIds
    );

    const { invited, skipped } = result;
    let message: string;
    if (invited.length > 0 && skipped.length === 0) {
      message = `Đã gửi lời mời đến ${invited.length} thành viên`;
    } else if (invited.length > 0 && skipped.length > 0) {
      message = `Đã gửi lời mời đến ${invited.length} thành viên. ${skipped.length} người đã ở trong nhóm hoặc đã có lời mời.`;
    } else {
      message =
        "Tất cả người dùng đã ở trong nhóm hoặc đã có lời mời chờ xử lý.";
    }

    ApiResponse.ok(res, result, message);
  });

  removeMember = asyncHandler<ValidatedRequest<MemberActionParams>>(
    async (req, res: Response): Promise<void> => {
      await groupChatService.removeMember(
        req.user!.id,
        req.validatedParams.groupId,
        req.validatedParams.targetUserId
      );
      ApiResponse.message(res, "Member removed");
    }
  );

  promoteMember = asyncHandler<ValidatedRequest<MemberActionParams>>(
    async (req, res: Response): Promise<void> => {
      await groupChatService.promoteMember(
        req.user!.id,
        req.validatedParams.groupId,
        req.validatedParams.targetUserId
      );
      ApiResponse.message(res, "Member promoted to admin");
    }
  );

  leaveGroup = asyncHandler<ValidatedRequest<GroupIdParams>>(
    async (req, res: Response): Promise<void> => {
      await groupChatService.removeMember(
        req.user!.id,
        req.validatedParams.groupId,
        req.user!.id
      );
      ApiResponse.message(res, "You have left the group");
    }
  );
}

export const groupChatController = new GroupChatController();
