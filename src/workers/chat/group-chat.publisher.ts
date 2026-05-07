import { ExchangeName, mqService } from "../../services/message-queue.service";
import {
  GroupMessagePayload,
  GroupNotificationPayload,
} from "../../types/group-chat.types";
export type { GroupMessagePayload, GroupNotificationPayload };

/**
 * Publish a new group message to the GROUP_MESSAGE queue.
 * Returns false (not throws) when the MQ channel is not ready — callers
 * can .catch(console.error) or fire-and-forget as appropriate.
 */
export function publishGroupMessage(
  payload: GroupMessagePayload
): Promise<boolean> {
  return mqService.publish(
    ExchangeName.GROUP_EVENTS,
    "group.message.new",
    payload
  );
}

/**
 * Publish a typed group notification to the GROUP_NOTIFICATION queue.
 * `payload` is a discriminated union — TypeScript narrows `data` automatically
 * when you switch on `payload.event` in consumers/workers.
 */
export function publishGroupNotification(
  payload: GroupNotificationPayload
): Promise<boolean> {
  return mqService.publish(
    ExchangeName.GROUP_EVENTS,
    "group.notification.send",
    payload
  );
}
