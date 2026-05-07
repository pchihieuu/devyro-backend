import { mqService, QueueName } from "../../services/message-queue.service";
import { GroupMessagePayload } from "../../types/group-chat.types";

/**
 * Worker: receives GroupMessagePayload from the GROUP_MESSAGE queue.
 *
 * WebSocket delivery is handled directly in GroupChatService.sendGroupMessage()
 * immediately after the DB save — this worker is the extension point for
 * async side-effects that must not block the HTTP response:
 *
 *   - Push notifications (FCM / APNs) for offline users
 *   - Email digest for users who haven't been online for N hours
 *   - Analytics / audit logging
 *   - Full-text search indexing
 *
 * Add handlers inside processGroupMessage() using Promise.allSettled so that
 * one failing handler never aborts the others.
 */
export async function startGroupMessageWorker(): Promise<void> {
  await mqService.consume<GroupMessagePayload>(
    QueueName.GROUP_MESSAGE,
    async ({ payload }) => {
      await processGroupMessage(payload);
    }
  );

  console.log("GroupMessageWorker started");
}

async function processGroupMessage(payload: GroupMessagePayload): Promise<void> {
  // Uncomment and implement as needed:
  //
  // await Promise.allSettled([
  //   handlePushNotification(payload),
  //   handleEmailDigest(payload),
  //   handleAnalytics(payload),
  //   handleSearchIndex(payload),
  // ]);

  void payload;
}