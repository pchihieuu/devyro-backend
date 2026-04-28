import amqplib, { Channel, ChannelModel } from "amqplib";

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

class MessageQueueService {
  private connection: ChannelModel | null = null;
  /** Shared channel dùng cho publish (lightweight) */
  private publishChannel: Channel | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;

  async connect(): Promise<void> {
    if (this.isConnecting || this.connection) return;
    this.isConnecting = true;

    try {
      const url = process.env.RABBITMQ_URL as string;
      if (!url) throw new Error("RABBITMQ_URL is not set");

      this.connection = await amqplib.connect(url);
      this.publishChannel = await this.connection.createChannel();

      await this.setupExchangesAndQueues(this.publishChannel);

      // Prefetch nhỏ cho publish channel (không consume)
      await this.publishChannel.prefetch(1);

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

  /**
   * Tạo một channel riêng dành cho consumer worker.
   * Mỗi worker nên có channel độc lập để tránh head-of-line blocking.
   */
  async createConsumerChannel(prefetch = 10): Promise<Channel> {
    if (!this.connection) throw new Error("MQ not connected");
    const ch = await this.connection.createChannel();
    await this.setupExchangesAndQueues(ch);
    await ch.prefetch(prefetch);
    return ch;
  }

  private async setupExchangesAndQueues(ch: Channel): Promise<void> {
    const TTL = 24 * 60 * 60 * 1000; // 24 hours

    await ch.assertExchange(ExchangeName.GROUP_EVENTS, "topic", {
      durable: true,
    });
    await ch.assertExchange(ExchangeName.CHAT_EVENTS, "topic", {
      durable: true,
    });

    await ch.assertQueue(QueueName.GROUP_MESSAGE, {
      durable: true,
      arguments: { "x-message-ttl": TTL },
    });
    await ch.assertQueue(QueueName.GROUP_NOTIFICATION, {
      durable: true,
      arguments: { "x-message-ttl": TTL },
    });
    await ch.assertQueue(QueueName.CHAT_MESSAGE, {
      durable: true,
      arguments: { "x-message-ttl": TTL },
    });

    await ch.bindQueue(
      QueueName.GROUP_MESSAGE,
      ExchangeName.GROUP_EVENTS,
      "group.message.*"
    );
    await ch.bindQueue(
      QueueName.GROUP_NOTIFICATION,
      ExchangeName.GROUP_EVENTS,
      "group.notification.*"
    );
    await ch.bindQueue(
      QueueName.CHAT_MESSAGE,
      ExchangeName.CHAT_EVENTS,
      "chat.message.*"
    );
  }

  private reconnect(): void {
    this.connection = null;
    this.publishChannel = null;

    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      console.log("Attempting to reconnect to RabbitMQ...");
      this.connect();
    }, 5000);
  }

  async publish<T>(
    exchange: ExchangeName,
    routingKey: string,
    payload: T
  ): Promise<boolean> {
    if (!this.publishChannel) {
      console.warn("MQ publish channel not ready, skipping publish");
      return false;
    }
    try {
      const message: QueueMessage<T> = {
        type: routingKey,
        payload,
        timestamp: new Date().toISOString(),
      };
      return this.publishChannel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        { persistent: true, contentType: "application/json" }
      );
    } catch (error) {
      console.error("MQ publish error:", error);
      return false;
    }
  }

  /**
   * Consume từ queue với channel riêng (prefetch=10).
   * Tự tạo consumer channel độc lập.
   */
  async consume<T>(
    queue: QueueName,
    handler: (msg: QueueMessage<T>) => Promise<void>
  ): Promise<void> {
    // Mỗi consumer worker tự tạo channel riêng
    const ch = await this.createConsumerChannel(10);

    await ch.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const content: QueueMessage<T> = JSON.parse(msg.content.toString());
        await handler(content);
        ch.ack(msg);
      } catch (error) {
        console.error(`Error processing message from ${queue}:`, error);
        // Nack, không requeue (tránh infinite loop)
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
