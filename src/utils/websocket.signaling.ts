import { Socket } from "socket.io";
import { videoCallService } from "../services/videocall.service";

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export function setupSignalingHandlers(
  socket: AuthenticatedSocket,
  io: any
): void {
  // WebRTC Signaling relay

  socket.on(
    "webrtc:offer",
    (data: { targetUserId: string; callId: string; offer: object }) => {
      if (!socket.userId) return;
      io.to(`user:${data.targetUserId}`).emit("webrtc:offer", {
        fromUserId: socket.userId,
        callId: data.callId,
        offer: data.offer,
      });
    }
  );

  socket.on(
    "webrtc:answer",
    (data: { targetUserId: string; callId: string; answer: object }) => {
      if (!socket.userId) return;
      io.to(`user:${data.targetUserId}`).emit("webrtc:answer", {
        fromUserId: socket.userId,
        callId: data.callId,
        answer: data.answer,
      });
    }
  );

  socket.on(
    "webrtc:ice_candidate",
    (data: { targetUserId: string; callId: string; candidate: object }) => {
      if (!socket.userId) return;
      io.to(`user:${data.targetUserId}`).emit("webrtc:ice_candidate", {
        fromUserId: socket.userId,
        callId: data.callId,
        candidate: data.candidate,
      });
    }
  );

  socket.on(
    "webrtc:renegotiate",
    (data: { targetUserId: string; callId: string; offer: object }) => {
      if (!socket.userId) return;
      io.to(`user:${data.targetUserId}`).emit("webrtc:renegotiate", {
        fromUserId: socket.userId,
        callId: data.callId,
        offer: data.offer,
      });
    }
  );

  /* FIX: Auto-leave when connection is lost
   * Socket.IO has built-in reconnection — only trigger leaveCall after
   * when the socket is actually completely disconnected (not temporarily dropped)
   */
  socket.on("disconnect", async (reason) => {
    if (!socket.userId) return;

    /* "transport close" = connection temporarily dropped (Socket.IO will try to reconnect)
     * "server namespace disconnect" = server has disconnected the socket (e.g. due to inactivity or server shutdown)
     * "client namespace disconnect" = client has disconnected the socket (e.g. due to closing the browser or manual disconnect)
     * */
    if (reason === "client namespace disconnect") return;

    console.log(
      `[WS] User ${socket.userId} disconnected (${reason}) — checking active calls`
    );

    try {
      await videoCallService.handleUserDisconnect(socket.userId);
    } catch (err) {
      console.error(
        `[WS] handleUserDisconnect error for ${socket.userId}:`,
        err
      );
    }
  });
}
