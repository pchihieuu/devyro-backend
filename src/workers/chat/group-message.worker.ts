// import { mqService, QueueName } from "../../services/message-queue.service";
// import { AppDataSource } from "../../config/database.config";
// import { GroupMember, MemberStatus } from "../../entities/GroupMember.entity";
// import { getWebSocketService } from "../../services/websocket.service";
// import { GroupMessagePayload } from "../../types/group-chat.types";

// export async function startGroupMessageWorker(): Promise<void> {
//   await mqService.consume<GroupMessagePayload>(
//     QueueName.GROUP_MESSAGE,
//     async ({ payload }) => {
//       await processGroupMessage(payload);
//     }
//   );
//   console.log("GroupMessageWorker started");
// }

// // group-message.worker.ts — REPLACE processGroupMessage
// async function processGroupMessage(
//   payload: GroupMessagePayload
// ): Promise<void> {
//   const { groupId, message } = payload;
//   const wsService = getWebSocketService();

//   // Dùng sendToGroup thay vì loop sendToUser
//   // Frontend đã join room group:{groupId} qua socket.emit("group:join:room")
//   wsService.sendToGroup(groupId, "group:message:new", { groupId, message });

//   console.log(
//     `[processGroupMessage] sent to group:${groupId} messageId=${message.id}`
//   );
// }

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
 * BUG FIX: Trước đây dùng sendToUser loop cho từng member —
 * sai vì frontend join room group:{groupId} (không phải user:{id}).
 * sendToUser emit vào room user:{id}, nhưng khi user đang chat group
 * họ chỉ listen group:{groupId}, nên UserB/C không bao giờ nhận được.
 *
 * Fix: dùng sendToGroup — emit 1 lần vào room group:{groupId},
 * tất cả member đang online đều nhận đồng thời.
 */
async function processGroupMessage(
  payload: GroupMessagePayload
): Promise<void> {
  const { groupId, message } = payload;

  const wsService = getWebSocketService();

  console.log(
    `[processGroupMessage] sendToGroup groupId=${groupId} messageId=${message.id}`
  );

  wsService.sendToGroup(groupId, "group:message:new", {
    groupId,
    message,
  });
}
