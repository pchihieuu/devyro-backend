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
  private publishChannel: Channel | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;

  /**
   * Guard: setupExchangesAndQueues chỉ cần chạy 1 lần per connection.
   * Các consumer channel tạo sau không cần assert lại.
   */
  private topologyReady = false;

  async connect(): Promise<void> {
    if (this.isConnecting || this.connection) return;
    this.isConnecting = true;

    try {
      const url = process.env.RABBITMQ_URL as string;
      if (!url) throw new Error("RABBITMQ_URL is not set");

      this.connection = await amqplib.connect(url);
      this.publishChannel = await this.connection.createChannel();

      // Setup topology 1 lần duy nhất trên publish channel
      await this.setupExchangesAndQueues(this.publishChannel);
      this.topologyReady = true;

      // publish channel KHÔNG cần prefetch — prefetch chỉ có nghĩa với consumer

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
   * Tạo consumer channel riêng.
   * Không gọi setupExchangesAndQueues lại — topology đã ready.
   * Nếu topology chưa ready (edge case restart), gọi lại 1 lần.
   */
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
    const TTL = 24 * 60 * 60 * 1000; // 24 hours

    // Chạy song song tất cả assertExchange — không phụ thuộc nhau
    await Promise.all([
      ch.assertExchange(ExchangeName.GROUP_EVENTS, "topic", { durable: true }),
      ch.assertExchange(ExchangeName.CHAT_EVENTS, "topic", { durable: true }),
    ]);

    // Chạy song song tất cả assertQueue
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

    // Chạy song song tất cả bindQueue
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
   * Return boolean thay vì void-wrapped Promise.
   * Caller có thể .catch() hoặc fire-and-forget tuỳ context.
   */
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
        console.error(`Error processing message from ${queue}:`, error);
        // Nack, không requeue — tránh poison message loop
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
