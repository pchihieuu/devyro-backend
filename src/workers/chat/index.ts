import { startGroupMessageWorker } from "./group-message.worker";
import { startGroupNotificationWorker } from "./group-notification.worker";

export { publishGroupMessage, publishGroupNotification } from "./group-chat.publisher";
export type { GroupMessagePayload, GroupNotificationPayload } from "./group-chat.publisher";

export async function startAllWorkers(): Promise<void> {
  await Promise.all([
    startGroupMessageWorker(),
    startGroupNotificationWorker(),
  ]);
  console.log("All chat workers started");
}