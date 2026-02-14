import { AppDataSource } from "../config/database.config";
import { Message, MessageType } from "../entities/Message.entity";
import { Conversation } from "../entities/Conversation.entity";
import { User } from "../entities/User.entity";
import { NotFoundError, BadRequestError } from "../utils/errors";
import { getWebSocketService } from "./websocket.service";

interface SendMessageData {
  receiverId: string;
  content: string;
  type?: MessageType;
  fileUrl?: string;
}

export class ChatService {
  private messageRepository = AppDataSource.getRepository(Message);
  private conversationRepository = AppDataSource.getRepository(Conversation);
  private userRepository = AppDataSource.getRepository(User);

  /**
   * Send a message
   */
  async sendMessage(senderId: string, data: SendMessageData): Promise<Message> {
    const { receiverId, content, type = MessageType.TEXT, fileUrl } = data;

    // Validate receiver exists
    const receiver = await this.userRepository.findOne({
      where: { id: receiverId },
    });

    if (!receiver) {
      throw new NotFoundError("Receiver not found");
    }

    if (senderId === receiverId) {
      throw new BadRequestError("Cannot send message to yourself");
    }

    // Create message
    const message = this.messageRepository.create({
      senderId,
      receiverId,
      content,
      type,
      fileUrl,
    });

    await this.messageRepository.save(message);

    // Load sender info
    const messageWithSender = await this.messageRepository.findOne({
      where: { id: message.id },
      relations: ["sender", "receiver"],
    });

    // Update or create conversation
    await this.updateConversation(senderId, receiverId, content);

    // Send real-time notification via WebSocket
    try {
      const wsService = getWebSocketService();
      wsService.sendMessageToUser(receiverId, {
        id: message.id,
        senderId,
        senderName: messageWithSender!.sender.name,
        senderAvatar: messageWithSender!.sender.avatar,
        content,
        type,
        fileUrl,
        createdAt: message.createdAt,
      });
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
    }

    return messageWithSender!;
  }

  /**
   * Get conversation messages
   */
  async getMessages(
    userId: string,
    otherUserId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ messages: Message[]; total: number; hasMore: boolean }> {
    const skip = (page - 1) * limit;

    const [messages, total] = await this.messageRepository.findAndCount({
      where: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
      relations: ["sender", "receiver"],
      order: { createdAt: "DESC" },
      take: limit,
      skip,
    });

    return {
      messages: messages.reverse(),
      total,
      hasMore: skip + messages.length < total,
    };
  }

  /**
   * Get all conversations for a user
   */
  async getConversations(userId: string): Promise<any[]> {
    const conversations = await this.conversationRepository.find({
      where: [{ user1Id: userId }, { user2Id: userId }],
      relations: ["user1", "user2"],
      order: { lastMessageAt: "DESC" },
    });

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

  /**
   * Mark messages as read
   */
  async markAsRead(userId: string, otherUserId: string): Promise<void> {
    // Mark messages as read
    await this.messageRepository.update(
      {
        senderId: otherUserId,
        receiverId: userId,
        isRead: false,
      },
      { isRead: true }
    );

    // Update conversation unread count
    const conversation = await this.findOrCreateConversation(
      userId,
      otherUserId
    );

    if (conversation.user1Id === userId) {
      conversation.user1UnreadCount = 0;
    } else {
      conversation.user2UnreadCount = 0;
    }

    await this.conversationRepository.save(conversation);
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    if (message.senderId !== userId) {
      throw new BadRequestError("You can only delete your own messages");
    }

    await this.messageRepository.remove(message);
  }

  /**
   * Update or create conversation
   */
  private async updateConversation(
    senderId: string,
    receiverId: string,
    lastMessage: string
  ): Promise<void> {
    const conversation = await this.findOrCreateConversation(
      senderId,
      receiverId
    );

    conversation.lastMessage = lastMessage;
    conversation.lastMessageSenderId = senderId;
    conversation.lastMessageAt = new Date();

    // Increment unread count for receiver
    if (conversation.user1Id === receiverId) {
      conversation.user1UnreadCount++;
    } else {
      conversation.user2UnreadCount++;
    }

    await this.conversationRepository.save(conversation);
  }

  /**
   * Find or create conversation
   */
  private async findOrCreateConversation(
    userId1: string,
    userId2: string
  ): Promise<Conversation> {
    let conversation = await this.conversationRepository.findOne({
      where: [
        { user1Id: userId1, user2Id: userId2 },
        { user1Id: userId2, user2Id: userId1 },
      ],
    });

    if (!conversation) {
      conversation = this.conversationRepository.create({
        user1Id: userId1,
        user2Id: userId2,
      });
      await this.conversationRepository.save(conversation);
    }

    return conversation;
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const conversations = await this.conversationRepository.find({
      where: [{ user1Id: userId }, { user2Id: userId }],
    });

    return conversations.reduce((total, conv) => {
      const unread =
        conv.user1Id === userId ? conv.user1UnreadCount : conv.user2UnreadCount;
      return total + unread;
    }, 0);
  }

  /**
   * Start a new conversation with a user
   */
  async startConversation(
    currentUserId: string,
    otherUserId: string
  ): Promise<any> {
    // Validate other user exists
    const otherUser = await this.userRepository.findOne({
      where: { id: otherUserId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    });

    if (!otherUser) {
      throw new NotFoundError("User not found");
    }

    if (currentUserId === otherUserId) {
      throw new BadRequestError("Cannot start conversation with yourself");
    }

    // Find or create conversation
    const conversation = await this.findOrCreateConversation(
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

  /**
   * Delete entire conversation
   */
  async deleteConversation(userId: string, otherUserId: string): Promise<void> {
    // Validate other user exists
    const otherUser = await this.userRepository.findOne({
      where: { id: otherUserId },
    });

    if (!otherUser) {
      throw new NotFoundError("User not found");
    }

    // Find conversation
    const conversation = await this.conversationRepository.findOne({
      where: [
        { user1Id: userId, user2Id: otherUserId },
        { user1Id: otherUserId, user2Id: userId },
      ],
    });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    // Delete all messages between these two users
    await this.messageRepository.delete([
      { senderId: userId, receiverId: otherUserId },
      { senderId: otherUserId, receiverId: userId },
    ]);

    // Delete the conversation record
    await this.conversationRepository.remove(conversation);

    // Send WebSocket notification to both users to update their UI
    try {
      const wsService = getWebSocketService();

      // Notify current user
      wsService.notifyConversationDeleted(userId, {
        otherUserId,
        conversationId: conversation.id,
      });

      // Notify other user
      wsService.notifyConversationDeleted(otherUserId, {
        otherUserId: userId,
        conversationId: conversation.id,
      });
    } catch (error) {
      console.error("Failed to send WebSocket notification:", error);
    }
  }
}

export const chatService = new ChatService();
