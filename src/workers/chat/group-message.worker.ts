import { AppDataSource } from "../../config/database.config";
import { GroupMember, MemberStatus } from "../../entities/GroupMember.entity";
import { mqService, QueueName } from "../../services/message-queue.service";
import { getWebSocketService } from "../../services/websocket.service";
import { GroupMessagePayload } from "./group-chat.publisher";


/**
 * Worker: nhận message từ queue GROUP_MESSAGE,
 * chỉ deliver đến các ACTIVE member qua WebSocket.
 *
 * Mỗi lần nhận message → query DB lấy active members → sendToUser từng người.
 * Worker này chạy độc lập, không block GroupNotificationWorker.
 */
export async function startGroupMessageWorker(): Promise<void> {
  await mqService.consume<GroupMessagePayload>(
    QueueName.GROUP_MESSAGE,
    async ({ payload }) => {
      const memberRepo = AppDataSource.getRepository(GroupMember);
      const wsService = getWebSocketService();

      const activeMembers = await memberRepo.find({
        where: { groupId: payload.groupId, status: MemberStatus.ACTIVE },
      });

      for (const { userId } of activeMembers) {
        wsService.sendToUser(userId, "group:message:new", {
          groupId: payload.groupId,
          message: payload.message,
        });
      }
    }
  );

  console.log("GroupMessageWorker started");
}