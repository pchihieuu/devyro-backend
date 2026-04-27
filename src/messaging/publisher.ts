import { EXCHANGES, publish } from "../config/rabbitmq.config";

/**
 * MQPublisher
 * ─────────────────────────────────────────────────────────────────────────────
 * Single entry point for every domain event that must cross instance boundaries.
 *
 * Rule of thumb:
 *  • Real-time, latency-sensitive, stateless relay (typing, WebRTC signaling)
 *    → emit directly on the local Socket.IO instance (do NOT publish to MQ).
 *  • Business events with delivery guarantees (call lifecycle, notifications)
 *    → publish here.
 */

// ─── Payload types ────────────────────────────────────────────────────────────

export interface WSEventPayload {
  targetUserId: string;
  event: string;
  data: unknown;
}

export interface NotificationPayload {
  userId: string;
  notification: {
    id: string;
    title: string;
    message: string;
    type: string;
    metadata?: unknown;
    createdAt: Date;
  };
}

export interface CallEventPayload {
  targetUserId: string;
  event: string;
  data: unknown;
}

// ─── Publisher ────────────────────────────────────────────────────────────────

export const MQPublisher = {
  /**
   * Broadcast a WebSocket event to a specific user across ALL instances.
   * Uses the fanout exchange — every instance will receive the message and
   * attempt to emit to the user's local WS room.
   */
  sendToUser(targetUserId: string, event: string, data: unknown): void {
    const payload: WSEventPayload = { targetUserId, event, data };
    publish(EXCHANGES.WS_FANOUT, "", payload);
  },

  /**
   * Deliver a push notification to a user.
   * Uses the direct notifications queue — delivered once by whichever instance
   * holds the user's socket.
   */
  sendNotification(payload: NotificationPayload): void {
    publish(EXCHANGES.NOTIFICATIONS, "", payload, { persistent: true });
  },

  /**
   * Publish a critical call lifecycle event (call:incoming, call:ended, etc.).
   * Uses the call.events queue with 30 s TTL — undelivered messages go to DLQ.
   */
  sendCallEvent(
    targetUserId: string,
    event: string,
    data: unknown
  ): void {
    const payload: CallEventPayload = { targetUserId, event, data };
    publish(EXCHANGES.CALL_EVENTS, "", payload, {
      persistent: true,
      expiration: "30000",
    });
  },
} as const;