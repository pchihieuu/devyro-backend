import { mqService, QueueName } from "../../services/message-queue.service";
import { getWebSocketService } from "../../services/websocket.service";
import { GroupNotificationPayload } from "../../types/group-chat.types";

// Events được deliver qua MQ worker (notification channel)
// group:message:new KHÔNG nằm đây — được handle bởi GroupMessageWorker
const MESSAGE_EVENTS = new Set(["group:message:new"]);

export async function startGroupNotificationWorker(): Promise<void> {
  await mqService.consume<GroupNotificationPayload>(
    QueueName.GROUP_NOTIFICATION,
    async ({ payload }) => {
      const { targetUserIds, event, data } = payload;

      if (!targetUserIds?.length) return;
      if (MESSAGE_EVENTS.has(event)) return; // GroupMessageWorker handles this

      const wsService = getWebSocketService();

      const results = await Promise.allSettled(
        targetUserIds.map((userId) =>
          Promise.resolve(wsService.sendToUser(userId, event, data))
        )
      );

      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        console.error(
          `[GroupNotificationWorker] ${failures.length}/${targetUserIds.length} failures for "${event}":`,
          failures.map((f) => (f as PromiseRejectedResult).reason)
        );
      }
    }
  );

  console.log("GroupNotificationWorker started");
}