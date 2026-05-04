import { AppDataSource } from "../../config/database.config";
import { mqService, QueueName } from "../../services/message-queue.service";
import { GroupMessagePayload } from "./group-chat.publisher";

/**
 * Worker: nhận message từ queue GROUP_MESSAGE,
 * chỉ deliver đến các ACTIVE member qua WebSocket.
 *
 * Mỗi lần nhận message → query DB lấy active members → sendToUser từng người.
 * Worker này chạy độc lập, không block GroupNotificationWorker.
 */

// group-message.worker.ts — sau khi WS đã direct deliver
// Worker giờ chỉ xử lý các tác vụ async như push notification, email digest, etc.
export async function startGroupMessageWorker(): Promise<void> {
  await mqService.consume<GroupMessagePayload>(
    QueueName.GROUP_MESSAGE,
    async ({ payload }) => {
      // WS đã được deliver trực tiếp trong service
      // Worker này giờ dùng cho: push notification, email, analytics...
      // await handlePushNotification(payload); // nếu có
    }
  );
  console.log("GroupMessageWorker started");
}