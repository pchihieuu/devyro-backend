import { z } from "zod";
import { MessageType } from "../entities/GroupMessage.entity";
import { createPaginationSchema } from "./common.validator";

/**
 * INPUT VALIDATION GAP: group-chat.routes.ts previously ran zero Zod
 * validation on any endpoint — every body field was read straight off
 * `req.body`/`req.query` inside group-chat.controller.ts (see
 * `const { name, description, memberIds } = req.body`, `parseInt(req.query.page
 * as string)`, etc.). That means: no length/type checks on group name or
 * message content, `memberIds`/`userIds` accepted anything (not even an
 * array), and page/limit could silently NaN. This file brings the module
 * in line with the rest of the codebase's validator layer.
 */

const groupIdParam = z.object({
  groupId: z.string().uuid("Invalid group ID format"),
});

export const groupIdParamSchema = z.object({ params: groupIdParam });
export type GroupIdParams = z.infer<typeof groupIdParamSchema>["params"];

export const createGroupSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Group name must be at least 2 characters")
      .max(255, "Group name must not exceed 255 characters"),
    description: z
      .string()
      .trim()
      .max(1000, "Description must not exceed 1000 characters")
      .optional()
      .or(z.literal("")),
    memberIds: z
      .array(z.string().uuid("Invalid member ID format"))
      .max(200, "Cannot invite more than 200 members at once")
      .default([]),
  }),
});
export type CreateGroupBody = z.infer<typeof createGroupSchema>["body"];

export const updateGroupSchema = z.object({
  params: groupIdParam,
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Group name must be at least 2 characters")
      .max(255, "Group name must not exceed 255 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, "Description must not exceed 1000 characters")
      .optional()
      .or(z.literal("")),
    avatar: z.string().url("Invalid avatar URL").optional().or(z.literal("")),
  }),
});
export type UpdateGroupParams = z.infer<typeof updateGroupSchema>["params"];
export type UpdateGroupBody = z.infer<typeof updateGroupSchema>["body"];

// Dùng chung cho filter `search` — trim + giới hạn độ dài để chặn ILIKE pattern
// quá dài; chuỗi rỗng coi như không lọc.
const searchField = z
  .string()
  .trim()
  .max(100, "Search keyword must not exceed 100 characters")
  .optional()
  .transform((v) => v || undefined);

export const getUserGroupsSchema = z.object({
  query: z.object({ search: searchField }),
});
export type GetUserGroupsQuery = z.infer<typeof getUserGroupsSchema>["query"];

export const getGroupMessagesSchema = z.object({
  params: groupIdParam,
  // sortBy/order don't apply here (messages are always newest-first,
  // paginated backwards) — reuse the shared pagination primitives for
  // page/limit only rather than redefining them.
  query: createPaginationSchema(["createdAt"], "createdAt")
    .pick({
      page: true,
      limit: true,
    })
    .extend({ search: searchField }),
});
export type GetGroupMessagesParams = z.infer<
  typeof getGroupMessagesSchema
>["params"];
export type GetGroupMessagesQuery = z.infer<
  typeof getGroupMessagesSchema
>["query"];

export const sendGroupMessageSchema = z.object({
  params: groupIdParam,
  body: z
    .object({
      content: z.string().trim().max(10000, "Message is too long").optional(),
      type: z.nativeEnum(MessageType).default(MessageType.TEXT),
      fileUrl: z.string().url("Invalid file URL").optional(),
      filePublicId: z.string().optional(),
      fileName: z.string().max(500).optional(),
      fileSize: z.coerce.number().int().positive().optional(),
      fileMimeType: z.string().optional(),
      replyToId: z.string().uuid("Invalid message ID format").optional(),
    })
    .refine((data) => data.type !== MessageType.TEXT || !!data.content, {
      message: "Message content is required for text messages",
      path: ["content"],
    })
    .refine((data) => data.type === MessageType.TEXT || !!data.fileUrl, {
      message: "fileUrl is required for media messages",
      path: ["fileUrl"],
    }),
});
export type SendGroupMessageParams = z.infer<
  typeof sendGroupMessageSchema
>["params"];
export type SendGroupMessageBody = z.infer<
  typeof sendGroupMessageSchema
>["body"];

export const deleteGroupMessageSchema = z.object({
  params: z.object({
    groupId: z.string().uuid("Invalid group ID format"),
    messageId: z.string().uuid("Invalid message ID format"),
  }),
});
export type DeleteGroupMessageParams = z.infer<
  typeof deleteGroupMessageSchema
>["params"];

export const addMembersSchema = z.object({
  params: groupIdParam,
  body: z.object({
    userIds: z
      .array(z.string().uuid("Invalid user ID format"))
      .min(1, "userIds must be a non-empty array")
      .max(200, "Cannot invite more than 200 members at once"),
  }),
});
export type AddMembersParams = z.infer<typeof addMembersSchema>["params"];
export type AddMembersBody = z.infer<typeof addMembersSchema>["body"];

export const memberActionParamsSchema = z.object({
  params: z.object({
    groupId: z.string().uuid("Invalid group ID format"),
    targetUserId: z.string().uuid("Invalid user ID format"),
  }),
});
export type MemberActionParams = z.infer<
  typeof memberActionParamsSchema
>["params"];
