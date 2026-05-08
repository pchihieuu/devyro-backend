import { mqService, QueueName } from "../../services/message-queue.service";
import { AppDataSource } from "../../config/database.config";
import { GroupMember, MemberStatus } from "../../entities/GroupMember.entity";
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

async function processGroupMessage(payload: GroupMessagePayload): Promise<void> {
  const { groupId, message, senderUserId } = payload;

  const memberRepo = AppDataSource.getRepository(GroupMember);
  const members = await memberRepo.find({
    where: { groupId, status: MemberStatus.ACTIVE },
    select: ["userId"],
  });

  const wsService = getWebSocketService();

  // Fan-out đến tất cả members TRỪ sender
  // Sender đã được add optimistically trong sendGroupMessage (frontend)
  // và message.id đã được pre-seed vào seenMessageIds → WS event sẽ bị de-dup
  await Promise.allSettled(
    members
      .filter((m) => m.userId !== senderUserId)
      .map((m) =>
        Promise.resolve(
          wsService.sendToUser(m.userId, "group:message:new", {
            groupId,
            message,
          })
        )
      )
  );
}