import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/database.config";
import { User } from "../entities/User.entity";
import { groupChatService } from "./group-chat.service";

interface AuthenticatedSocket extends Socket {
  userId?: string;
}
export class WebSocketService {
  private io: SocketIOServer;
  private userSockets: Map<string, string> = new Map();
  private syncDebounce: Map<string, NodeJS.Timeout> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CLIENT_URL,
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupConnectionHandlers();
  }

  private setupMiddleware() {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error("Authentication error: No token provided"));
        }

        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "your-secret-key"
        ) as { id: string };

        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
          where: { id: decoded.id },
        });

        if (!user) {
          return next(new Error("Authentication error: User not found"));
        }

        socket.userId = user.id;
        next();
      } catch (error) {
        next(new Error("Authentication error: Invalid token"));
      }
    });
  }

  private setupConnectionHandlers() {
    this.io.on("connection", (socket: AuthenticatedSocket) => {
      console.log(`User connected: ${socket.userId}`);

      
      if (socket.userId) {
        this.userSockets.set(socket.userId, socket.id);
        socket.join(`user:${socket.userId}`);
        this.io.emit("user:online", { userId: socket.userId });

        // ✅ Debounce sync — tránh hammer DB khi reconnect liên tục
        const existing = this.syncDebounce.get(socket.userId);
        if (existing) clearTimeout(existing);

        const timeout = setTimeout(() => {
          this.syncDebounce.delete(socket.userId!);
          groupChatService.syncOnReconnect(socket.userId!).catch((err) => {
            console.error("Error syncing group chat state on reconnect:", err);
          });
        }, 500); // debounce 500ms

        this.syncDebounce.set(socket.userId, timeout);
      }

      // Typing indicators — real-time, same-instance relay, NOT queued
      socket.on("typing:start", (data: { receiverId: string }) => {
        if (socket.userId) {
          this.io.to(`user:${data.receiverId}`).emit("typing:start", {
            userId: socket.userId,
          });
        }
      });

      socket.on("typing:stop", (data: { receiverId: string }) => {
        if (socket.userId) {
          this.io.to(`user:${data.receiverId}`).emit("typing:stop", {
            userId: socket.userId,
          });
        }
      });

      // Group typing indicators
      socket.on("group:typing:start", (data: { groupId: string }) => {
        if (socket.userId) {
          socket.to(`group:${data.groupId}`).emit("group:typing:start", {
            groupId: data.groupId,
            userId: socket.userId,
          });
        }
      });

      socket.on("group:typing:stop", (data: { groupId: string }) => {
        if (socket.userId) {
          socket.to(`group:${data.groupId}`).emit("group:typing:stop", {
            groupId: data.groupId,
            userId: socket.userId,
          });
        }
      });

      // Join group socket room (called after accepting invitation)
      socket.on("group:join:room", (data: { groupId: string }) => {
        if (socket.userId) {
          socket.join(`group:${data.groupId}`);
        }
      });

      socket.on("group:leave:room", (data: { groupId: string }) => {
        if (socket.userId) {
          socket.leave(`group:${data.groupId}`);
        }
      });

      socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.userId}`);
        if (socket.userId) {
          this.userSockets.delete(socket.userId);
          this.io.emit("user:offline", { userId: socket.userId });
        }
      });
    });
  }

  /** Send to specific user room */
  public sendToUser(userId: string, event: string, data: unknown) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /** Send to all members of a group room */
  public sendToGroup(groupId: string, event: string, data: unknown) {
    this.io.to(`group:${groupId}`).emit(event, data);
  }

  public sendMessageToUser(
    userId: string,
    message: {
      id: string;
      senderId: string;
      senderName: string;
      senderAvatar: string | null;
      content: string;
      type: string;
      fileUrl?: string | null;
      createdAt: Date;
    }
  ) {
    this.io.to(`user:${userId}`).emit("message:new", message);
  }

  public sendToGroupExclude(
    groupId: string,
    excludeSocketId: string,
    event: string,
    data: unknown
  ) {
    this.io.to(`group:${groupId}`).except(excludeSocketId).emit(event, data);
  }

  public sendNotificationToUser(
    userId: string,
    notification: {
      id: string;
      title: string;
      message: string;
      type: string;
      metadata?: unknown;
      createdAt: Date;
    }
  ) {
    this.io.to(`user:${userId}`).emit("notification", notification);
  }

  public notifyConversationDeleted(
    userId: string,
    data: { otherUserId: string; conversationId: string }
  ) {
    this.io.to(`user:${userId}`).emit("conversation:deleted", data);
  }

  public getIO() {
    return this.io;
  }

  public isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }
}

let webSocketService: WebSocketService;

export const initializeWebSocket = (server: HTTPServer): WebSocketService => {
  webSocketService = new WebSocketService(server);
  return webSocketService;
};

export const getWebSocketService = (): WebSocketService => {
  if (!webSocketService) {
    throw new Error("WebSocket service not initialized");
  }
  return webSocketService;
};
