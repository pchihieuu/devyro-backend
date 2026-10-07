import amqplib, { Channel, ChannelModel } from "amqplib";
import { config } from "./../config/env.config";
import { logger } from "../utils/logger";
import { Gauge, Counter } from "prom-client";

export enum QueueName {
  GROUP_MESSAGE = "group.message",
  GROUP_NOTIFICATION = "group.notification",
  CHAT_MESSAGE = "chat.message",
}

export enum ExchangeName {
  GROUP_EVENTS = "group.events",
  CHAT_EVENTS = "chat.events",
}

/**
 * DLQ FIX: every queue now declares x-dead-letter-exchange pointing here.
 * Previously ch.nack(msg, false, false) (requeue=false, no DLX configured)
 * silently DISCARDED the message forever on any consumer error or after
 * exhausting delivery — no way to inspect/replay a poison message. Now a
 * nack with requeue=false is auto-routed here by RabbitMQ instead of
 * dropped, and DLQ_TTL lets an operator re-queue after fixing the bug
 * (messages expire back onto DLX_EXCHANGE -> original queue via CC/dead-letter
 * chaining is intentionally NOT set up automatically — replay is a manual,
 * reviewed action, not automatic, since the failure could be poison data).
 */
const DLX_EXCHANGE = "dead-letter.events";
const DLQ_NAME = "dead-letter.queue";

/** Delivery attempts before we give up and route a message to the DLQ instead of requeueing. */
const MAX_DELIVERY_ATTEMPTS = 5;

export interface QueueMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
  correlationId?: string;
}

/**
 * Simple async mutex — serializes concurrent publish calls on the same channel.
 * Prevents AMQP frame interleaving when multiple messages are published
 * concurrently through a single channel (root cause of the "last message missing" bug).
 */
class PublishMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }
}

const envMs = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Callback chạy sau MỖI lần kết nối lại thành công (vd đăng ký lại consumer). */
export type ReconnectedHandler = () => Promise<void>;

export class MessageQueueService {
  private connection: ChannelModel | null = null;
  private closing = false;
  private reconnecting = false;
  private reconnectedHandlers: ReconnectedHandler[] = [];
  private publishChannel: Channel | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private topologyReady = false;

  /**
   * FIX: Serialize concurrent publishes to prevent AMQP frame interleaving.
   * Root cause of "last message in burst not delivered" bug.
   */
  private publishMutex = new PublishMutex();

  async connect(): Promise<void> {
    if (this.isConnecting || this.connection) return;
    this.isConnecting = true;

    try {
      const url = config.rmq.url;
      if (!url) throw new Error("RABBITMQ_URL is not set");

      this.connection = await amqplib.connect(url);
      this.publishChannel = await this.connection.createChannel();

      await this.setupExchangesAndQueues(this.publishChannel);
      this.topologyReady = true;

      this.isConnecting = false;
      console.log("Connected to RabbitMQ");

      this.attachListeners(this.connection);
      this.watchPublishChannel(this.publishChannel);
    } catch (error) {
      this.isConnecting = false;
      console.error("Failed to connect to RabbitMQ:", error);
      // Chỉ gọi reconnect() khi đang runtime (không phải startup).
      // Khi startup, connectWithRetry() tự handle retry — không schedule ngầm ở đây.
    }
  }

  async connectWithRetry(maxAttempts = 10, delayMs = 3000): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.connection = null;
      this.isConnecting = false;

      await this.connect();

      if (this.isConnected()) {
        // Đăng ký reconnect handler cho runtime sau khi startup thành công
        this.registerRuntimeReconnect();
        return;
      }
      if (attempt < maxAttempts) {
        console.log(
          `[MQ] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms...`
        );
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }

    throw new Error(`[MQ] Could not connect after ${maxAttempts} attempts`);
  }

  /**
   * Gọi sau khi startup connect thành công.
   * Override event handlers để dùng reconnect() (silent retry) thay vì throw.
   */

  private registerRuntimeReconnect(): void {
    if (!this.connection) return;
    this.connection.removeAllListeners("error");
    this.connection.removeAllListeners("close");
    this.attachListeners(this.connection);
  }

  /**
   * Gắn listener cho 1 connection cụ thể. Sự kiện từ một connection CŨ (đã bị
   * thay thế) bị bỏ qua — nếu không, 'error' + 'close' của kết nối cũ đến muộn
   * sẽ huỷ kết nối mới và kích hoạt reconnect thừa (đăng ký trùng consumer).
   */
  private attachListeners(conn: ChannelModel): void {
    conn.on("error", (err) => {
      console.error("RabbitMQ connection error:", err);
      if (this.connection === conn) this.reconnect();
    });
    conn.on("close", () => {
      if (this.connection !== conn) return; // kết nối cũ / đã xử lý
      console.warn("RabbitMQ connection closed. Reconnecting...");
      this.reconnect();
    });
  }

  /**
   * amqplib ném lỗi KHÔNG bắt được nếu channel phát 'error' mà không có
   * listener (có thể làm sập process). Channel publish chết riêng lẻ (kết nối
   * vẫn sống) được tạo lại tại chỗ thay vì để publish() thất bại mãi.
   */
  private watchPublishChannel(ch: Channel): void {
    ch.on("error", (err) => {
      console.error("[MQ] publish channel error:", err);
    });
    ch.on("close", () => {
      if (this.publishChannel !== ch || this.closing) return;
      this.publishChannel = null;
      const conn = this.connection;
      if (!conn) return; // mất cả kết nối: reconnect() lo
      conn
        .createChannel()
        .then((fresh) => {
          if (this.connection !== conn) return void fresh.close().catch(() => undefined);
          this.publishChannel = fresh;
          this.watchPublishChannel(fresh);
          console.warn("[MQ] publish channel recreated");
        })
        .catch(() => {
          if (this.connection === conn) this.reconnect();
        });
    });
  }

  /** Đăng ký việc cần làm lại sau mỗi lần kết nối lại (consumer của workers…). */
  onReconnected(handler: ReconnectedHandler): void {
    this.reconnectedHandlers.push(handler);
  }

  async createConsumerChannel(prefetch = 10): Promise<Channel> {
    if (!this.connection) throw new Error("MQ not connected");
    const ch = await this.connection.createChannel();

    if (!this.topologyReady) {
      await this.setupExchangesAndQueues(ch);
    }

    await ch.prefetch(prefetch);
    return ch;
  }

  private async setupExchangesAndQueues(ch: Channel): Promise<void> {
    const TTL = 24 * 60 * 60 * 1000;
    // DLQ messages kept much longer than live queues — they're for manual
    // inspection/replay by an operator, not routine traffic.
    const DLQ_TTL = 7 * 24 * 60 * 60 * 1000;

    await Promise.all([
      ch.assertExchange(ExchangeName.GROUP_EVENTS, "topic", { durable: true }),
      ch.assertExchange(ExchangeName.CHAT_EVENTS, "topic", { durable: true }),
      ch.assertExchange(DLX_EXCHANGE, "fanout", { durable: true }),
    ]);

    await ch.assertQueue(DLQ_NAME, {
      durable: true,
      arguments: { "x-message-ttl": DLQ_TTL },
    });
    await ch.bindQueue(DLQ_NAME, DLX_EXCHANGE, "");

    const liveQueueArgs = {
      "x-message-ttl": TTL,
      "x-dead-letter-exchange": DLX_EXCHANGE,
    };

    await Promise.all([
      ch.assertQueue(QueueName.GROUP_MESSAGE, {
        durable: true,
        arguments: liveQueueArgs,
      }),
      ch.assertQueue(QueueName.GROUP_NOTIFICATION, {
        durable: true,
        arguments: liveQueueArgs,
      }),
      ch.assertQueue(QueueName.CHAT_MESSAGE, {
        durable: true,
        arguments: liveQueueArgs,
      }),
    ]);

    await Promise.all([
      ch.bindQueue(
        QueueName.GROUP_MESSAGE,
        ExchangeName.GROUP_EVENTS,
        "group.message.*"
      ),
      ch.bindQueue(
        QueueName.GROUP_NOTIFICATION,
        ExchangeName.GROUP_EVENTS,
        "group.notification.*"
      ),
      ch.bindQueue(
        QueueName.CHAT_MESSAGE,
        ExchangeName.CHAT_EVENTS,
        "chat.message.*"
      ),
    ]);
  }

  /**
   * Kết nối lại NHIỀU LẦN với backoff luỹ thừa (mặc định 5s → 30s) cho tới khi
   * thành công.
   *
   * BUG FIX: bản cũ chỉ thử đúng 1 lần sau 5s. `connect()` nuốt lỗi (không
   * throw) nên nếu RabbitMQ vẫn đang tắt ở lần thử đó thì KHÔNG còn lần thử
   * nào nữa — app không bao giờ tự nối lại dù RabbitMQ đã bật. Hệ quả với
   * outbox: event nằm mãi ở "channel not ready".
   */
  private reconnect(): void {
    this.connection = null;
    this.publishChannel = null;
    this.topologyReady = false;
    if (this.closing || this.reconnecting) return;
    this.reconnecting = true;
    this.scheduleReconnect(envMs("MQ_RECONNECT_BASE_MS", 5000), 1);
  }

  private scheduleReconnect(delayMs: number, attempt: number): void {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(async () => {
      if (this.closing) {
        this.reconnecting = false;
        return;
      }
      console.log(`Attempting to reconnect to RabbitMQ (attempt ${attempt})...`);
      this.isConnecting = false;
      await this.connect();

      if (!this.isConnected()) {
        mqReconnectAttempts.inc({ result: "failed" });
        const max = envMs("MQ_RECONNECT_MAX_MS", 30_000);
        this.scheduleReconnect(Math.min(delayMs * 2, max), attempt + 1);
        return;
      }

      mqReconnectAttempts.inc({ result: "success" });
      this.reconnecting = false;
      this.registerRuntimeReconnect();
      await this.runReconnectedHandlers();
    }, delayMs);
  }

  private async runReconnectedHandlers(): Promise<void> {
    const conn = this.connection;
    for (const handler of this.reconnectedHandlers) {
      try {
        await handler();
      } catch (error) {
        logger.error("[MQ] reconnect handler failed, forcing another reconnect", {
          error: error instanceof Error ? error.message : String(error),
        });
        // Đóng kết nối để 'close' kích hoạt reconnect() → chạy lại các handler.
        if (conn && this.connection === conn) await conn.close().catch(() => undefined);
        return;
      }
    }
  }

  /**
   * FIX: Serialize publishes through mutex to prevent frame interleaving.
   * Also log when publish returns false (channel buffer full) instead of silently dropping.
   */
  async publish<T>(
    exchange: ExchangeName,
    routingKey: string,
    payload: T
  ): Promise<boolean> {
    if (!this.publishChannel) {
      console.warn(
        "[MQ] publish channel not ready, message dropped:",
        routingKey
      );
      return false;
    }

    await this.publishMutex.acquire();
    try {
      const message: QueueMessage<T> = {
        type: routingKey,
        payload,
        timestamp: new Date().toISOString(),
      };

      const ok = this.publishChannel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        { persistent: true, contentType: "application/json" }
      );

      if (!ok) {
        // Channel write buffer full — drain event will fire when ready
        // For now log so we can detect backpressure issues
        console.warn(
          `[MQ] publish returned false for ${routingKey} — channel buffer full`
        );
      } else {
        console.log(`[MQ] published ${routingKey} OK`);
      }

      return ok;
    } catch (error) {
      console.error("[MQ] publish error:", error);
      return false;
    } finally {
      this.publishMutex.release();
    }
  }

  /**
   * Local (in-process) redelivery counter keyed by messageId, capped at
   * MAX_DELIVERY_ATTEMPTS. We deliberately do NOT use ch.nack(msg, false,
   * true) (redeliver-in-place) for retries: a poison message would then
   * spin at the head of the queue forever, blocking every message behind
   * it (head-of-line blocking) since prefetch is small. Instead we retry
   * a bounded number of times in-process with a short delay, and only
   * nack(requeue=false) — which the queue's x-dead-letter-exchange routes
   * to the DLQ — once attempts are exhausted. This counter resets on
   * worker restart, which is an accepted tradeoff: worst case a message
   * gets a few extra retries after a deploy, never fewer.
   */
  private attemptCounts = new Map<string, number>();

  async consume<T>(
    queue: QueueName,
    handler: (msg: QueueMessage<T>) => Promise<void>
  ): Promise<void> {
    const ch = await this.createConsumerChannel(10);

    await ch.consume(queue, async (msg) => {
      if (!msg) return;
      const messageId =
        msg.properties.messageId || msg.fields.deliveryTag.toString();

      try {
        const content: QueueMessage<T> = JSON.parse(msg.content.toString());
        await handler(content);
        ch.ack(msg);
        this.attemptCounts.delete(messageId);
      } catch (error) {
        const attempts = (this.attemptCounts.get(messageId) ?? 0) + 1;
        logger.error(`[MQ] Error processing message from ${queue}`, {
          error: error instanceof Error ? error.message : error,
          attempts,
        });

        if (attempts >= MAX_DELIVERY_ATTEMPTS) {
          this.attemptCounts.delete(messageId);
          // Give up — requeue=false routes to the queue's
          // x-dead-letter-exchange instead of discarding the message.
          logger.error(
            `[MQ] ${queue} message exceeded ${MAX_DELIVERY_ATTEMPTS} attempts, routing to DLQ`
          );
          ch.nack(msg, false, false);
        } else {
          this.attemptCounts.set(messageId, attempts);
          ch.ack(msg); // remove from the live queue…
          setTimeout(
            () => {
              // …and re-publish for another attempt after a short backoff,
              // instead of an in-place requeue that would block the queue.
              this.publishChannel?.sendToQueue(
                queue,
                msg.content,
                msg.properties
              );
            },
            Math.min(1000 * 2 ** attempts, 30_000)
          );
        }
      }
    });
  }

  async close(): Promise<void> {
    try {
      this.closing = true; // chặn reconnect do chính việc đóng kết nối gây ra
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      await this.publishChannel?.close();
      await this.connection?.close();
      console.log("RabbitMQ connection closed gracefully");
    } catch (err) {
      console.error("Error closing RabbitMQ connection:", err);
    }
  }

  isConnected(): boolean {
    return this.connection !== null && this.publishChannel !== null;
  }
}

export const mqService = new MessageQueueService();

const mqReconnectAttempts = new Counter({
  name: "jobportal_mq_reconnect_attempts_total",
  help: "Số lần thử kết nối lại RabbitMQ theo kết quả",
  labelNames: ["result"] as const,
});

// 1 = đang kết nối (có publish channel), 0 = mất kết nối. Nên cảnh báo khi == 0 kéo dài.
new Gauge({
  name: "jobportal_mq_connected",
  help: "RabbitMQ đang kết nối (1) hay không (0)",
  collect() {
    this.set(mqService.isConnected() ? 1 : 0);
  },
});
