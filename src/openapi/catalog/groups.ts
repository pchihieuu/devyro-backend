import { z } from "zod";
import { OpCatalog } from "../types";
import {
  groupDetail,
  groupMessage,
  groupSummary,
  pendingInvitation,
} from "../schemas/misc";
import { paginationMeta } from "../schemas/common";

const groupBase = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    avatar: z.string().nullable(),
  })
  .catchall(z.unknown());

export const groupsCatalog: OpCatalog = {
  "GET /groups": {
    summary: "My group",
    description:
      "`search` filters by group name. Results are sorted by the most recent message, with groups containing no messages appearing at the end.",
    data: z.array(groupSummary),
  },
  "POST /groups": { summary: "Create group", status: 201, data: groupBase },
  "GET /groups/invitations/pending": {
    summary: "Group invitation pending",
    data: z.array(pendingInvitation),
  },
  "GET /groups/:groupId": { summary: "Group details", data: groupDetail },
  "PATCH /groups/:groupId": {
    summary: "Group update (group admin)",
    data: groupBase,
  },
  "POST /groups/:groupId/leave": { summary: "Leave group" },
  "POST /groups/:groupId/invitations/accept": {
    summary: "Accept the invitation",
  },
  "POST /groups/:groupId/invitations/reject": {
    summary: "Declining an invitation",
  },
  "GET /groups/:groupId/messages": {
    summary: "Group messages",
    description:
      "`data.{total,hasMore}` is RETAINED for compatibility; the frontend (FE) should migrate to the standard `pagination` structure and subsequently remove these two fields. `search` filters based on content.",
    data: z.object({
      messages: z.array(groupMessage),
      total: z.number().int(),
      hasMore: z.boolean(),
    }),
    extra: { pagination: paginationMeta },
  },
  "POST /groups/:groupId/messages": {
    summary: "Send a group message",
    status: 201,
    data: groupMessage,
  },
  "DELETE /groups/:groupId/messages/:messageId": {
    summary: "Delete group messages",
  },
  "POST /groups/:groupId/media": {
    summary: "Upload media for the group",
    status: 201,
    data: z
      .object({
        fileUrl: z.string().url(),
        fileName: z.string().nullish(),
        fileSize: z.number().int().nullish(),
        fileMimeType: z.string().nullish(),
        type: z.string().nullish(),
      })
      .catchall(z.unknown()),
    multipart: { field: "file" },
  },
  "PUT /groups/:groupId/read": { summary: "Mark group as read" },
  "POST /groups/:groupId/members": {
    summary: "Invite members",
    data: z.object({
      invited: z.array(z.string().uuid()),
      skipped: z.array(z.string().uuid()),
    }),
  },
  "DELETE /groups/:groupId/members/:targetUserId": {
    summary: "Remove member (group admin)",
  },
  "PUT /groups/:groupId/members/:targetUserId/promote": {
    summary: "Promote to group admin role",
  },
};
