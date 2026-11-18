import { z } from "zod";
import { OpCatalog } from "../types";
import {
  conversation,
  conversationSummary,
  directMessage,
} from "../schemas/misc";

export const chatCatalog: OpCatalog = {
  "GET /chat/conversations": {
    summary: "List of 1-on-1 conversations",
    data: z.array(conversationSummary),
  },
  "POST /chat/conversations/start": {
    summary: "Start / initiate a conversation with a user",
    status: 201,
    data: conversation,
  },
  "GET /chat/unread-count": {
    summary: "Total unread messages",
    data: z.object({ count: z.number().int() }),
  },
  "GET /chat/messages/:otherUserId": {
    summary: "Messages with a user",
    description:
      "Legacy-style pagination: `data.{messages,total,hasMore}`; `messages` are sorted from oldest to newest.",
    data: z.object({
      messages: z.array(directMessage),
      total: z.number().int(),
      hasMore: z.boolean(),
    }),
  },
  "POST /chat/messages": {
    summary: "Send a 1-on-1 message",
    status: 201,
    data: directMessage,
  },
  "PUT /chat/messages/:otherUserId/read": {
    summary: "Mark conversation as read",
  },
  "DELETE /chat/messages/:messageId": { summary: "Delete a message" },
  "DELETE /chat/conversations/:otherUserId": {
    summary: "Delete entire conversation",
  },
};
