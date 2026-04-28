import { mqService, QueueName } from "../../services/message-queue.service";
import { getWebSocketService } from "../../services/websocket.service";
import { GroupNotificationPayload } from "./group-chat.publisher";

/**
 * Worker: nhận notification từ queue GROUP_NOTIFICATION,
 * forward đến từng targetUserId qua WebSocket.
 *
 * Xử lý các event: group:invitation, group:member:joined,
 * group:member:removed, group:member:promoted, group:message:deleted,
 * group:messages:seen, group:invitation:rejected
 */
export async function startGroupNotificationWorker(): Promise<void> {
  await mqService.consume<GroupNotificationPayload>(
    QueueName.GROUP_NOTIFICATION,
    async ({ payload }) => {
      const wsService = getWebSocketService();

      for (const userId of payload.targetUserIds) {
        wsService.sendToUser(userId, payload.event, payload.data);
      }
    }
  );

  console.log("GroupNotificationWorker started");
}