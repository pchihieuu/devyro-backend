import { ExchangeName, mqService } from "../../services/message-queue.service";

export interface GroupMessagePayload {
  groupId: string;
  message: {
    id: string;
    senderId: string;
    senderName: string;
    senderAvatar: string | null;
    content: string | null;
    type: string;
    fileUrl?: string | null;
    fileName?: string | null;
    fileSize?: number | null;
    fileMimeType?: string | null;
    replyTo: unknown;
    seenBy: unknown[];
    seenByMe: boolean;
    isDeleted: boolean;
    createdAt: Date;
  };
  senderUserId: string;
}

export interface GroupNotificationPayload {
  event: string;
  targetUserIds: string[];
  data: unknown;
}

export function publishGroupMessage(payload: GroupMessagePayload): void {
  mqService.publish(ExchangeName.GROUP_EVENTS, "group.message.new", payload);
}

export async function publishGroupNotification(
  payload: GroupNotificationPayload
): Promise<void> {
  await mqService.publish(
    ExchangeName.GROUP_EVENTS,
    "group.notification.send",
    payload
  );
}