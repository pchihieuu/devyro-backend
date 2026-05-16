import { mqService, QueueName } from "../../services/message-queue.service";
import { getWebSocketService } from "../../services/websocket.service";
import { GroupMessagePayload } from "../../types/group-chat.types";

export async function startGroupMessageWorker(): Promise<void> {
  await mqService.consume<GroupMessagePayload>(
    QueueName.GROUP_MESSAGE,
    async ({ payload }) => {
      await processGroupMessage(payload);
    }
  );
  console.log("GroupMessageWorker started");
}

/**
 * Chỉ dùng sendToGroup — không còn sendToUser fallback.
 *
 * Lý do bỏ dual-delivery:
 * - Frontend đã fix join room timing: socket emit "group:join:room" ngay
 *   trong onSync handler (không chờ groupIdsKey effect re-run).
 * - Dual-delivery gây mỗi receiver nhận 2 WS events cho cùng 1 message
 *   → log "2 received" + "skipped duplicate" ở mọi user.
 * - Frontend dedup (seenMessageIds) che giấu vấn đề nhưng không giải quyết
 *   được root cause — waste bandwidth + CPU không cần thiết.
 *
 * sendToGroup emit 1 lần vào room group:{groupId}.
 * Tất cả member đã join room đều nhận đồng thời — đủ và đúng.
 */
async function processGroupMessage(
  payload: GroupMessagePayload
): Promise<void> {
  const { groupId, message } = payload;
  const wsService = getWebSocketService();

  wsService.sendToGroup(groupId, "group:message:new", { groupId, message });

  console.log(
    `[processGroupMessage] sendToGroup groupId=${groupId} messageId=${message.id}`
  );
}
