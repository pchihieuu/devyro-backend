import { wsConnections } from "../observability/metrics";
import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { authenticateAccessToken } from "./access-token-auth.service";
import { groupChatService } from "./group-chat.service";
import { NotificationWSPayload } from "../types/notification.types";

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
      // Khai báo tường minh (thay vì để default 25000/20000ms) để dễ đối
      // chiếu với cấu hình client khi debug disconnect lặp lại — nếu client
      // dùng giá trị khác, mismatch này có thể tự gây ra ping timeout giả.
      pingInterval: 25000,
      pingTimeout: 20000,
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

        // Cùng logic với HTTP `protect`: chữ ký + blacklist + validAfter.
        // (Trước đây jwt.verify với secret fallback "your-secret-key" và bỏ qua
        // thu hồi token → token đã logout vẫn kết nối realtime được.)
        const { user } = await authenticateAccessToken(token);

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
      wsConnections.inc();

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
        }, 100);

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

      socket.on("disconnect", (reason) => {
        // Log rõ nguyên nhân để phân biệt: "ping timeout" (mất kết nối
        // thật/mismatch cấu hình), "transport close" (server restart/redeploy,
        // đúng với ts-node-dev --respawn), "client namespace disconnect"
        // (client tự chủ động ngắt), v.v. Trước đây log không có `reason`
        // nên không thể xác định server tự restart hay do mạng.
        wsConnections.dec();
        console.log(`User disconnected: ${socket.userId} (reason: ${reason})`);
        if (socket.userId) {
          // FIX: chỉ xóa khỏi map & báo offline nếu socket.id NÀY vẫn đang
          // là socket hiện hành của user trong map. Trước đây delete/emit
          // vô điều kiện — nếu user đã reconnect bằng socket mới (B) TRƯỚC
          // KHI socket cũ (A) kịp nhận diện mất kết nối (thường gặp khi tab
          // bị trình duyệt throttle rồi wake up), disconnect handler của A
          // chạy sau sẽ xóa nhầm entry của B đang sống, bắn "user:offline"
          // sai cho một user vẫn đang online — đúng là nguyên nhân của
          // pattern "offline → online → offline" bạn thấy khi treo tab lâu.
          const isCurrentSocket =
            this.userSockets.get(socket.userId) === socket.id;
          if (isCurrentSocket) {
            this.userSockets.delete(socket.userId);
            this.io.emit("user:offline", { userId: socket.userId });
          } else {
            console.log(
              `Stale socket disconnect ignored for ${socket.userId} — a newer connection is already active`
            );
          }
        }
      });
    });
  }

  /** Send to specific user room */
  // public sendToUser(userId: string, event: string, data: unknown) {
  //   this.io.to(`user:${userId}`).emit(event, data);
  // }

  public sendToUser(userId: string, event: string, data: unknown) {
    const room = `user:${userId}`;
    const socketsInRoom = this.io.sockets.adapter.rooms.get(room);
    console.log(
      `[sendToUser] event=${event} userId=${userId} sockets=${socketsInRoom?.size ?? 0}`
    );
    this.io.to(room).emit(event, data);
  }

  /** Send to all members of a group room */
  // public sendToGroup(groupId: string, event: string, data: unknown) {
  //   this.io.to(`group:${groupId}`).emit(event, data);
  // }
  public sendToGroup(groupId: string, event: string, data: unknown) {
    const room = `group:${groupId}`;
    const sockets = this.io.sockets.adapter.rooms.get(room);
    console.log(
      `[sendToGroup] event=${event} groupId=${groupId} sockets_in_room=${sockets?.size ?? 0}`
    );
    this.io.to(room).emit(event, data);
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
    notification: NotificationWSPayload
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
