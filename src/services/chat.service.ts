import { Message, MessageType } from "../entities/Message.entity";
import { NotFoundError, BadRequestError } from "../utils/errors";
import { ensureOwnership } from "../utils/authorization.util";
import { getWebSocketService } from "./websocket.service";
import {
  messageRepository,
  MessageRepository,
} from "../repositories/message.repository";
import {
  conversationRepository,
  ConversationRepository,
} from "../repositories/conversation.repository";
import {
  userRepository,
  UserRepository,
} from "../repositories/user.repository";
import {
  MessageWithParticipants,
  ConversationSummary,
} from "../types/chat.types";

interface SendMessageData {
  receiverId: string;
  content: string;
  type?: MessageType;
  fileUrl?: string;
}

export class ChatService {
  constructor(
    private readonly messageRepo: MessageRepository = messageRepository,
    private readonly conversationRepo: ConversationRepository = conversationRepository,
    private readonly userRepo: UserRepository = userRepository
  ) {}

  async sendMessage(
    senderId: string,
    data: SendMessageData
  ): Promise<MessageWithParticipants> {
    const { receiverId, content, type = MessageType.TEXT, fileUrl } = data;

    if (senderId === receiverId) {
      throw new BadRequestError("Cannot send message to yourself");
    }

    const [receiver, sender] = await Promise.all([
      this.userRepo.findByIdSelect(receiverId, ["id", "name", "avatar"]),
      this.userRepo.findByIdSelect(senderId, ["id", "name", "avatar"]),
    ]);

    if (!receiver) throw new NotFoundError("Receiver not found");
    if (!sender) throw new NotFoundError("Sender not found");

    const message = this.messageRepo.create({
      senderId,
      receiverId,
      content,
      type,
      fileUrl,
    });
    await this.messageRepo.save(message);

    try {
      const wsService = getWebSocketService();
      wsService.sendMessageToUser(receiverId, {
        id: message.id,
        senderId,
        senderName: sender.name,
        senderAvatar: sender.avatar,
        content,
        type,
        fileUrl,
        createdAt: message.createdAt,
      });
    } catch (error) {
      console.error("WS send failed:", error);
    }

    this.updateConversation(senderId, receiverId, content).catch((err) =>
      console.error("updateConversation error:", err)
    );

    return Object.assign(message, { sender, receiver }) as MessageWithParticipants;
  }

  async getMessages(
    userId: string,
    otherUserId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ messages: Message[]; total: number; hasMore: boolean }> {
    const [messages, total] = await this.messageRepo.findAndCountBetweenUsers(
      userId,
      otherUserId,
      page,
      limit
    );

    return {
      messages: messages.reverse(),
      total,
      hasMore: (page - 1) * limit + messages.length < total,
    };
  }

  async getConversations(userId: string): Promise<ConversationSummary[]> {
    const conversations = await this.conversationRepo.findAllForUser(userId);

    return conversations.map((conv) => {
      const isUser1 = conv.user1Id === userId;
      const otherUser = isUser1 ? conv.user2 : conv.user1;
      const unreadCount = isUser1
        ? conv.user1UnreadCount
        : conv.user2UnreadCount;

      return {
        id: conv.id,
        otherUser: {
          id: otherUser.id,
          name: otherUser.name,
          avatar: otherUser.avatar,
          email: otherUser.email,
        },
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        unreadCount,
        createdAt: conv.createdAt,
      };
    });
  }

  async markAsRead(userId: string, otherUserId: string): Promise<void> {
    await this.messageRepo.markAsReadBetweenUsers(userId, otherUserId);

    const conversation = await this.conversationRepo.findOrCreateConversation(
      userId,
      otherUserId
    );

    if (conversation.user1Id === userId) {
      conversation.user1UnreadCount = 0;
    } else {
      conversation.user2UnreadCount = 0;
    }

    await this.conversationRepo.save(conversation);
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepo.findById(messageId);

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    ensureOwnership(
      message.senderId,
      userId,
      "You can only delete your own messages"
    );

    const { senderId, receiverId } = message;
    await this.messageRepo.remove(message);

    // Nếu tin nhắn vừa xoá là lastMessage của conversation, preview trong
    // danh sách conversation sẽ bị "ma" (hiển thị nội dung đã xoá) nếu
    // không đồng bộ lại.
    await this.syncLastMessageAfterDelete(senderId, receiverId);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const conversations =
      await this.conversationRepo.findAllForUnreadCount(userId);

    return conversations.reduce((total, conv) => {
      const unread =
        conv.user1Id === userId ? conv.user1UnreadCount : conv.user2UnreadCount;
      return total + unread;
    }, 0);
  }

  async startConversation(
    currentUserId: string,
    otherUserId: string
  ): Promise<ConversationSummary> {
    const otherUser = await this.userRepo.findByIdSelect(otherUserId, [
      "id",
      "name",
      "email",
      "avatar",
    ]);

    if (!otherUser) {
      throw new NotFoundError("User not found");
    }

    if (currentUserId === otherUserId) {
      throw new BadRequestError("Cannot start conversation with yourself");
    }

    const conversation = await this.conversationRepo.findOrCreateConversation(
      currentUserId,
      otherUserId
    );

    return {
      id: conversation.id,
      otherUser: {
        id: otherUser.id,
        name: otherUser.name,
        avatar: otherUser.avatar,
        email: otherUser.email,
      },
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount: 0,
      createdAt: conversation.createdAt,
    };
  }

  async deleteConversation(userId: string, otherUserId: string): Promise<void> {
    const otherUser = await this.userRepo.findById(otherUserId);

    if (!otherUser) {
      throw new NotFoundError("User not found");
    }

    const conversation = await this.conversationRepo.findByUsers(
      userId,
      otherUserId
    );

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    await this.messageRepo.deleteBetweenUsers(userId, otherUserId);
    await this.conversationRepo.remove(conversation);

    try {
      const wsService = getWebSocketService();

      wsService.notifyConversationDeleted(userId, {
        otherUserId,
        conversationId: conversation.id,
      });

      wsService.notifyConversationDeleted(otherUserId, {
        otherUserId: userId,
        conversationId: conversation.id,
      });
    } catch (error) {
      console.error("Failed to send WebSocket notification:", error);
    }
  }

  // ---- private helpers ----

  private async updateConversation(
    senderId: string,
    receiverId: string,
    lastMessage: string
  ): Promise<void> {
    const conversation = await this.conversationRepo.findOrCreateConversation(
      senderId,
      receiverId
    );

    conversation.lastMessage = lastMessage;
    conversation.lastMessageSenderId = senderId;
    conversation.lastMessageAt = new Date();

    if (conversation.user1Id === receiverId) {
      conversation.user1UnreadCount++;
    } else {
      conversation.user2UnreadCount++;
    }

    await this.conversationRepo.save(conversation);
  }

  private async syncLastMessageAfterDelete(
    userId1: string,
    userId2: string
  ): Promise<void> {
    const conversation = await this.conversationRepo.findByUsers(
      userId1,
      userId2
    );
    if (!conversation) return;

    const latest = await this.messageRepo.findLatestBetweenUsers(
      userId1,
      userId2
    );

    conversation.lastMessage = latest?.content ?? null;
    conversation.lastMessageSenderId = latest?.senderId ?? null;
    conversation.lastMessageAt = latest?.createdAt ?? null;

    await this.conversationRepo.save(conversation);
  }
}

export const chatService = new ChatService();