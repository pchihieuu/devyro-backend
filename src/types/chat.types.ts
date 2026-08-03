import { Message } from "../entities/Message.entity";
import { User } from "../entities/User.entity";

type ChatParticipant = Pick<User, "id" | "name" | "avatar">;

export type MessageWithParticipants = Message & {
  sender: ChatParticipant;
  receiver: ChatParticipant;
};

export type ConversationSummary = {
  id: string;
  otherUser: Pick<User, "id" | "name" | "avatar" | "email">;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  createdAt: Date;
};
