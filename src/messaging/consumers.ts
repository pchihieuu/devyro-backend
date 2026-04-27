import { ConsumeMessage } from "amqplib";
import {
  bindInstanceFanoutQueue,
  consume,
  parseMessage,
  QUEUES,
} from "../config/rabbitmq.config";
import { getWebSocketService } from "../services/websocket.service";
import {
  CallEventPayload,
  NotificationPayload,
  WSEventPayload,
} from "./publisher";

/**
 * setupConsumers
 * ─────────────────────────────────────────────────────────────────────────────
 * Called once on startup, after both RabbitMQ and WebSocket service are ready.
 *
 * Three consumers:
 *  1. fanout consumer   — receives EVERY ws event broadcast; emits if the user
 *                         is connected to THIS instance.
 *  2. call events       — critical call lifecycle events with DLQ fallback.
 *  3. notifications     — push notifications, persistent delivery.
 */
export async function setupConsumers(): Promise<void> {
  // ── 1. Per-instance fanout queue (ws.fanout exchange) ──────────────────────
  const fanoutQueue = await bindInstanceFanoutQueue();

  await consume(fanoutQueue, async (msg: ConsumeMessage) => {
    const { targetUserId, event, data } = parseMessage<WSEventPayload>(msg);
    const ws = getWebSocketService();

    if (ws.isUserOnline(targetUserId)) {
      ws.sendToUser(targetUserId, event, data);
    }
    // If not online on this instance, simply ack — another instance will handle it.
    // For guaranteed delivery when user is offline, use the notifications queue.
  });

  // ── 2. Call events queue (call.events exchange) ────────────────────────────
  await consume(
    QUEUES.CALL_EVENTS,
    async (msg: ConsumeMessage) => {
      const { targetUserId, event, data } =
        parseMessage<CallEventPayload>(msg);
      const ws = getWebSocketService();

      if (ws.isUserOnline(targetUserId)) {
        ws.sendToUser(targetUserId, event, data);
      } else {
        /**
         * User is not on this instance.
         * nack WITHOUT requeue → message goes to DLQ after the 30 s TTL
         * expires on the main queue anyway, so this is a soft signal that
         * the event was "undeliverable now".
         *
         * Production upgrade: use Redis pub/sub adapter for Socket.IO so all
         * instances share a single room namespace, then every message is
         * delivered exactly once.
         */
        throw new Error(`[CallConsumer] User ${targetUserId} not on this instance`);
      }
    },
    5 // lower prefetch — call events are high priority
  );

  // ── 3. Notifications queue (notifications exchange) ────────────────────────
  await consume(QUEUES.NOTIFICATIONS, async (msg: ConsumeMessage) => {
    const { userId, notification } = parseMessage<NotificationPayload>(msg);
    const ws = getWebSocketService();

    if (ws.isUserOnline(userId)) {
      ws.sendNotificationToUser(userId, notification);
    } else {
      // Nack + requeue so another instance can try.
      // Set a max-retry sentinel via a header counter in production.
      throw new Error(`[NotifConsumer] User ${userId} not on this instance — requeue`);
    }
  });

  console.log("[RabbitMQ] All consumers started");
}