import { mqService, QueueName } from "../../services/message-queue.service";
import { getWebSocketService } from "../../services/websocket.service";
import { GroupNotificationPayload } from "../../types/group-chat.types";

/**
 * Worker: receives typed GroupNotificationPayload from GROUP_NOTIFICATION queue
 * and fans out to each targetUserId via WebSocket in parallel.
 *
 * Uses Promise.allSettled so a failure for one user never aborts delivery
 * to the rest of the batch. Each rejection is logged individually.
 *
 * Because GroupNotificationPayload is a discriminated union on `event`,
 * wsService.sendToUser receives the correctly-typed `data` for each event.
 */
export async function startGroupNotificationWorker(): Promise<void> {
  await mqService.consume<GroupNotificationPayload>(
    QueueName.GROUP_NOTIFICATION,
    async ({ payload }) => {
      const wsService = getWebSocketService();
      const { targetUserIds, event, data } = payload;

      if (!targetUserIds?.length) return;

      const results = await Promise.allSettled(
        targetUserIds.map((userId) =>
          Promise.resolve(wsService.sendToUser(userId, event, data))
        )
      );

      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        console.error(
          `[GroupNotificationWorker] ${failures.length}/${targetUserIds.length} delivery failures for event "${event}":`,
          failures.map((f) => (f as PromiseRejectedResult).reason)
        );
      }
    }
  );

  console.log("GroupNotificationWorker started");
}