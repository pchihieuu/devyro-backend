import { z } from "zod";
import { MessageType } from "../entities/Message.entity";
import { createPaginationSchema } from "./common.validator";

const uuidField = z.string().uuid({ message: "Invalid user id" });

export const getMessagesSchema = z.object({
  params: z.object({
    otherUserId: uuidField,
  }),
  query: createPaginationSchema(["createdAt"], "createdAt").omit({
    sortBy: true,
    order: true,
  }),
});
export type GetMessagesParams = z.infer<typeof getMessagesSchema>["params"];
export type GetMessagesQuery = z.infer<typeof getMessagesSchema>["query"];

export const markAsReadSchema = z.object({
  params: z.object({
    otherUserId: uuidField,
  }),
});
export type MarkAsReadParams = z.infer<typeof markAsReadSchema>["params"];

export const deleteMessageSchema = z.object({
  params: z.object({
    messageId: z.string().uuid({ message: "Invalid message id" }),
  }),
});
export type DeleteMessageParams = z.infer<typeof deleteMessageSchema>["params"];

export const deleteConversationSchema = z.object({
  params: z.object({
    otherUserId: uuidField,
  }),
});
export type DeleteConversationParams = z.infer<
  typeof deleteConversationSchema
>["params"];

export const sendMessageSchema = z.object({
  body: z.object({
    receiverId: uuidField,
    content: z
      .string()
      .trim()
      .min(1, { message: "Content is required" })
      .max(10000, { message: "Content is too long" }),
    type: z.nativeEnum(MessageType).optional(),
    fileUrl: z.string().max(2048).optional(),
  }),
});
export type SendMessageBody = z.infer<typeof sendMessageSchema>["body"];

export const startConversationSchema = z.object({
  body: z.object({
    otherUserId: uuidField,
  }),
});
export type StartConversationBody = z.infer<
  typeof startConversationSchema
>["body"];