import { z } from "zod";
import { createPaginationSchema } from "./common.validator";

const NOTIFICATION_SORTABLE_FIELDS = ["createdAt"] as const;

export const getNotificationsSchema = z.object({
  query: createPaginationSchema(NOTIFICATION_SORTABLE_FIELDS, "createdAt"),
});
export type GetNotificationsQuery = z.infer<
  typeof getNotificationsSchema
>["query"];

export const notificationIdSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: "Notification invalid" }),
  }),
});
export type NotificationIdParams = z.infer<
  typeof notificationIdSchema
>["params"];
