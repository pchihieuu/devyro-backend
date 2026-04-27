/**
 * rabbitmq.config.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * FIX: amqplib.connect() returns Promise<ChannelModel>, NOT Promise<Connection>.
 *      ChannelModel is the top-level object that owns createChannel().
 *      Connection is the raw TCP connection exposed via channelModel.connection.
 *
 *      Old (broken):  let connection: Connection  ← TS2739 type mismatch
 *      New (correct): let channelModel: ChannelModel
 *
 * Topology
 * ─────────
 *  ws.fanout  (fanout exchange)
 *    └─► ws-instance-<uuid>   — exclusive, autoDelete, one per API instance
 *        Every instance gets a copy of every fanout message.
 *        The consumer emits to Socket.IO only if the user is local.
 *
 *  call.events  (direct exchange)
 *    └─► call.events          — durable, TTL 30 s
 *    └─► call.events.dlq      — dead-letter queue via call.events.dlx
 *
 *  notifications  (direct exchange)
 *    └─► notifications        — durable, no TTL (user may be temporarily offline)
 */

import amqplib, { Channel, ChannelModel, ConsumeMessage } from "amqplib";
import { randomUUID } from "crypto";

// ─── Constants ────────────────────────────────────────────────────────────────

export const EXCHANGES = {
  WS_FANOUT: "ws.fanout",
  CALL_EVENTS: "call.events",
  CALL_DLX: "call.events.dlx",
  NOTIFICATIONS: "notifications",
} as const;

export const QUEUES = {
  CALL_EVENTS: "call.events",
  CALL_DLQ: "call.events.dlq",
  NOTIFICATIONS: "notifications",
} as const;

/** Unique ID for this OS process — scopes the per-instance fanout queue name. */
export const INSTANCE_ID = randomUUID();

// ─── Module-level singletons ──────────────────────────────────────────────────

/**
 * ChannelModel  — object returned by amqplib.connect().
 *   .createChannel()  → opens a new AMQP channel
 *   .close()          → closes the TCP connection
 *   .connection       → raw Connection (TCP layer, rarely needed directly)
 *
 * We do NOT type this as Connection — Connection is the inner TCP object,
 * not the top-level handle returned by connect().
 */
let channelModel: ChannelModel | null = null;

/**
 * Two dedicated channels:
 *   publishChannel  → Channel#publish only (never consume here)
 *   consumerChannel → Channel#consume + ack/nack only (never publish here)
 *
 * Reason: mixing publish and consume on one channel can cause head-of-line
 * blocking when a slow consumer triggers flow-control on the shared channel.
 */
let publishChannel: Channel | null = null;
let consumerChannel: Channel | null = null;

// ─── Connect ──────────────────────────────────────────────────────────────────

export async function connectRabbitMQ(): Promise<void> {
  const url = process.env.RABBITMQ_URL ?? "amqp://guest:guest@rabbitmq:5672";
  console.log("[RabbitMQ] Connecting…");

  // ✅ Returns ChannelModel (not Connection)
  channelModel = await amqplib.connect(url);

  channelModel.on("error", (err: Error) => {
    console.error("[RabbitMQ] Connection error:", err.message);
  });

  channelModel.on("close", () => {
    console.warn("[RabbitMQ] Connection closed — reconnecting in 5 s…");
    channelModel = null;
    publishChannel = null;
    consumerChannel = null;
    setTimeout(connectRabbitMQ, 5_000);
  });

  // ✅ createChannel() is a method on ChannelModel
  publishChannel = await channelModel.createChannel();
  consumerChannel = await channelModel.createChannel();

  await declareTopology(publishChannel);

  console.log(`[RabbitMQ] Ready. Instance: ${INSTANCE_ID}`);
}

// ─── Topology declaration ─────────────────────────────────────────────────────

async function declareTopology(ch: Channel): Promise<void> {
  // 1. ws.fanout — fanout exchange; queues are per-instance and ephemeral
  await ch.assertExchange(EXCHANGES.WS_FANOUT, "fanout", { durable: true });

  // 2. Dead-letter exchange + DLQ for expired/rejected call events
  await ch.assertExchange(EXCHANGES.CALL_DLX, "direct", { durable: true });
  await ch.assertQueue(QUEUES.CALL_DLQ, { durable: true });
  await ch.bindQueue(QUEUES.CALL_DLQ, EXCHANGES.CALL_DLX, "");

  // 3. call.events — 30 s TTL; expired messages routed to DLX
  await ch.assertExchange(EXCHANGES.CALL_EVENTS, "direct", { durable: true });
  await ch.assertQueue(QUEUES.CALL_EVENTS, {
    durable: true,
    arguments: {
      "x-message-ttl": 30_000,
      "x-dead-letter-exchange": EXCHANGES.CALL_DLX,
    },
  });
  await ch.bindQueue(QUEUES.CALL_EVENTS, EXCHANGES.CALL_EVENTS, "");

  // 4. notifications — durable, no TTL
  await ch.assertExchange(EXCHANGES.NOTIFICATIONS, "direct", { durable: true });
  await ch.assertQueue(QUEUES.NOTIFICATIONS, { durable: true });
  await ch.bindQueue(QUEUES.NOTIFICATIONS, EXCHANGES.NOTIFICATIONS, "");
}

// ─── Per-instance fanout queue ────────────────────────────────────────────────

/**
 * Called once during consumer setup.
 * Declares an exclusive queue for THIS process and binds it to ws.fanout.
 * RabbitMQ auto-deletes the queue when the channel closes (process exit).
 */
export async function bindInstanceFanoutQueue(): Promise<string> {
  if (!consumerChannel)
    throw new Error("[RabbitMQ] Consumer channel not ready");

  const { queue } = await consumerChannel.assertQueue(
    `ws-instance-${INSTANCE_ID}`,
    { durable: false, exclusive: true, autoDelete: true }
  );

  await consumerChannel.bindQueue(queue, EXCHANGES.WS_FANOUT, "");
  console.log(`[RabbitMQ] Fanout queue bound: ${queue}`);
  return queue;
}

// ─── Publish ──────────────────────────────────────────────────────────────────

export function publish(
  exchange: string,
  routingKey: string,
  payload: object,
  options: { persistent?: boolean; expiration?: string } = {}
): void {
  if (!publishChannel) {
    console.error("[RabbitMQ] Cannot publish — channel not ready");
    return;
  }

  publishChannel.publish(
    exchange,
    routingKey,
    Buffer.from(JSON.stringify(payload)),
    {
      contentType: "application/json",
      persistent: options.persistent ?? true,
      ...(options.expiration ? { expiration: options.expiration } : {}),
    }
  );
}

// ─── Consume ──────────────────────────────────────────────────────────────────

export async function consume(
  queue: string,
  handler: (msg: ConsumeMessage) => Promise<void>,
  prefetch = 10
): Promise<void> {
  if (!consumerChannel)
    throw new Error("[RabbitMQ] Consumer channel not ready");

  // prefetch = max unacked messages in-flight per consumer
  await consumerChannel.prefetch(prefetch);

  consumerChannel.consume(queue, async (msg) => {
    if (!msg) return; // broker cancelled the consumer
    try {
      await handler(msg);
      consumerChannel!.ack(msg);
    } catch (err) {
      console.error("[RabbitMQ] Handler failed:", (err as Error).message);
      // nack without requeue → expired messages go to DLQ
      consumerChannel!.nack(msg, false, false);
    }
  });
}

// ─── Parse helper ─────────────────────────────────────────────────────────────

export function parseMessage<T>(msg: ConsumeMessage): T {
  return JSON.parse(msg.content.toString()) as T;
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

export async function closeRabbitMQ(): Promise<void> {
  try {
    await publishChannel?.close();
    await consumerChannel?.close();
    // ✅ close() is on ChannelModel, not on Connection
    await channelModel?.close();
    console.log("[RabbitMQ] Closed gracefully");
  } catch {
    // suppress on shutdown
  }
}
