import amqplib, { Channel, ChannelModel, Options } from "amqplib";

export enum QueueName {
  GROUP_MESSAGE = "group.message",
  GROUP_NOTIFICATION = "group.notification",
  CHAT_MESSAGE = "chat.message",
}

export enum ExchangeName {
  GROUP_EVENTS = "group.events",
  CHAT_EVENTS = "chat.events",
}

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

class MessageQueueService {
  private connection: ChannelModel | null = null;
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
      const url = process.env.RABBITMQ_URL as string;
      if (!url) throw new Error("RABBITMQ_URL is not set");

      this.connection = await amqplib.connect(url);
      this.publishChannel = await this.connection.createChannel();

      await this.setupExchangesAndQueues(this.publishChannel);
      this.topologyReady = true;

      this.isConnecting = false;
      console.log("Connected to RabbitMQ");

      this.connection.on("error", (err) => {
        console.error("RabbitMQ connection error:", err);
        this.reconnect();
      });

      this.connection.on("close", () => {
        console.warn("RabbitMQ connection closed. Reconnecting...");
        this.reconnect();
      });
    } catch (error) {
      this.isConnecting = false;
      console.error("Failed to connect to RabbitMQ:", error);
      this.reconnect();
    }
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

    await Promise.all([
      ch.assertExchange(ExchangeName.GROUP_EVENTS, "topic", { durable: true }),
      ch.assertExchange(ExchangeName.CHAT_EVENTS, "topic", { durable: true }),
    ]);

    await Promise.all([
      ch.assertQueue(QueueName.GROUP_MESSAGE, {
        durable: true,
        arguments: { "x-message-ttl": TTL },
      }),
      ch.assertQueue(QueueName.GROUP_NOTIFICATION, {
        durable: true,
        arguments: { "x-message-ttl": TTL },
      }),
      ch.assertQueue(QueueName.CHAT_MESSAGE, {
        durable: true,
        arguments: { "x-message-ttl": TTL },
      }),
    ]);

    await Promise.all([
      ch.bindQueue(QueueName.GROUP_MESSAGE, ExchangeName.GROUP_EVENTS, "group.message.*"),
      ch.bindQueue(QueueName.GROUP_NOTIFICATION, ExchangeName.GROUP_EVENTS, "group.notification.*"),
      ch.bindQueue(QueueName.CHAT_MESSAGE, ExchangeName.CHAT_EVENTS, "chat.message.*"),
    ]);
  }

  private reconnect(): void {
    this.connection = null;
    this.publishChannel = null;
    this.topologyReady = false;

    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      console.log("Attempting to reconnect to RabbitMQ...");
      this.connect();
    }, 5000);
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
      console.warn("[MQ] publish channel not ready, message dropped:", routingKey);
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
        console.warn(`[MQ] publish returned false for ${routingKey} — channel buffer full`);
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

  async consume<T>(
    queue: QueueName,
    handler: (msg: QueueMessage<T>) => Promise<void>
  ): Promise<void> {
    const ch = await this.createConsumerChannel(10);

    await ch.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const content: QueueMessage<T> = JSON.parse(msg.content.toString());
        await handler(content);
        ch.ack(msg);
      } catch (error) {
        console.error(`[MQ] Error processing message from ${queue}:`, error);
        ch.nack(msg, false, false);
      }
    });
  }

  async close(): Promise<void> {
    try {
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