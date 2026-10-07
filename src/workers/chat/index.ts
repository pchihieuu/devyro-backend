import { mqService } from "../../services/message-queue.service";
import { startGroupMessageWorker } from "./group-message.worker";
import { startGroupNotificationWorker } from "./group-notification.worker";

export {
  publishGroupMessage,
  publishGroupNotification,
} from "./group-chat.publisher";
export type {
  GroupMessagePayload,
  GroupNotificationPayload,
} from "../../types/group-chat.types";

const subscribeAll = async (): Promise<void> => {
  await Promise.all([
    startGroupMessageWorker(),
    startGroupNotificationWorker(),
  ]);
};
let reconnectHookRegistered = false;

export async function startAllWorkers(): Promise<void> {
  await subscribeAll();
  console.log("All chat workers started");
  // Consumer channel gắn với 1 kết nối cụ thể và chết cùng nó. Không đăng ký
  // lại sau reconnect thì tin nhắn vẫn vào queue nhưng KHÔNG ai tiêu thụ →
  // realtime (WebSocket) im lặng dù publish đã thành công.

  if (!reconnectHookRegistered) {
    reconnectHookRegistered = true;
    mqService.onReconnected(async () => {
      await subscribeAll();
      console.log("Chat workers re-subscribed after RabbitMQ reconnect");
    });
  }
}
