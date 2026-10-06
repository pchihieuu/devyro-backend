import { OutboxRepository, outboxRepository } from "../repositories/outbox.repository";
import { publishGroupMessage } from "./chat/group-chat.publisher";
import { GroupMessagePayload } from "../types/group-chat.types";
import { logger } from "../utils/logger";
import { outboxEvents, registerOutboxGauges } from "../observability/metrics";

/**
 * Relay của transactional outbox: đọc event đã commit trong `outbox_events` và
 * publish ra RabbitMQ. Chạy trong chính process API (poll + `kick()` ngay sau
 * khi commit để giữ độ trễ realtime gần như cũ); có thể tách thành process
 * riêng sau này vì claim dùng lease + SKIP LOCKED.
 *
 * Giao hàng at-least-once: nếu publish xong mà chưa kịp đánh dấu, hoặc lease
 * hết hạn lúc relay chết, event sẽ được gửi lại → consumer phải idempotent
 * (tin nhắn có `message.id` để FE/worker dedupe).
 */

export const OUTBOX_TOPICS = {
  GROUP_MESSAGE_NEW: "group.message.new",
} as const;

type Handler = (payload: unknown) => Promise<boolean>;

const HANDLERS: Record<string, Handler> = {
  [OUTBOX_TOPICS.GROUP_MESSAGE_NEW]: (payload) =>
    publishGroupMessage(payload as GroupMessagePayload),
};

const envInt = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const BATCH_SIZE = () => envInt("OUTBOX_BATCH_SIZE", 50);
const POLL_MS = () => envInt("OUTBOX_POLL_MS", 2000);
const MAX_ATTEMPTS = () => envInt("OUTBOX_MAX_ATTEMPTS", 10);
const LEASE_SECONDS = 60;
const PURGE_EVERY_MS = 60 * 60 * 1000;
const RETENTION_DAYS = () => envInt("OUTBOX_RETENTION_DAYS", 7);

/** Backoff luỹ thừa 2s, 4s, 8s … tối đa 5 phút. */
export const backoffSeconds = (attempts: number): number =>
  Math.min(2 ** attempts, 300);

export class OutboxRelay {
  private timer: NodeJS.Timeout | null = null;
  private purgeTimer: NodeJS.Timeout | null = null;
  private running = false;
  private rerun = false;
  private stopped = true;

  constructor(
    private readonly repo: OutboxRepository = outboxRepository,
    private readonly handlers: Record<string, Handler> = HANDLERS
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    const tick = () => {
      if (this.stopped) return;
      void this.drain().finally(() => {
        if (!this.stopped) this.timer = setTimeout(tick, POLL_MS());
      });
    };
    registerOutboxGaugesOnce(this.repo);
    tick();
    this.purgeTimer = setInterval(() => void this.purge(), PURGE_EVERY_MS);
    this.purgeTimer.unref();
    logger.info("Outbox relay started");
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.purgeTimer) clearInterval(this.purgeTimer);
    // Đợi vòng đang chạy (nếu có) xong để không bỏ dở giữa lúc publish.
    while (this.running) await new Promise((r) => setTimeout(r, 50));
    logger.info("Outbox relay stopped");
  }

  /** Gọi ngay sau khi commit để gửi sớm thay vì chờ vòng poll kế tiếp. */
  kick(): void {
    if (this.stopped) return;
    void this.drain();
  }

  /** Xử lý đến khi hết event đến hạn. An toàn khi bị gọi chồng (kick + poll). */
  async drain(): Promise<void> {
    if (this.running) {
      this.rerun = true; // có event mới trong lúc đang chạy → chạy thêm 1 vòng
      return;
    }
    this.running = true;
    try {
      do {
        this.rerun = false;
        let processed: number;
        do {
          processed = await this.processBatch();
        } while (processed === BATCH_SIZE() && !this.stopped);
      } while (this.rerun && !this.stopped);
    } catch (error) {
      logger.error("Outbox relay drain failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.running = false;
    }
  }

  /** @returns số event đã lấy ra xử lý trong lượt này. */
  async processBatch(): Promise<number> {
    const events = await this.repo.claimDue(BATCH_SIZE(), LEASE_SECONDS);

    for (const event of events) {
      const handler = this.handlers[event.topic];
      try {
        if (!handler) throw new Error(`No outbox handler for topic "${event.topic}"`);
        const ok = await handler(event.payload);
        // publish() trả false (không throw) khi kênh MQ chưa sẵn sàng.
        if (!ok) throw new Error("Message queue rejected publish (channel not ready)");

        await this.repo.markPublished(event.id);
        outboxEvents.inc({ topic: event.topic, result: "published" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const dead = event.attempts >= MAX_ATTEMPTS();
        await this.repo
          .markFailed(event.id, message, backoffSeconds(event.attempts), dead)
          .catch(() => undefined);
        outboxEvents.inc({ topic: event.topic, result: dead ? "dead" : "retry" });
        const meta = {
          outboxId: event.id,
          topic: event.topic,
          attempts: event.attempts,
          dead,
          error: message,
        };
        if (dead) logger.error("Outbox event moved to dead state", meta);
        else logger.warn("Outbox event publish failed, will retry", meta);
      }
    }
    return events.length;
  }

  private async purge(): Promise<void> {
    try {
      const n = await this.repo.purgePublishedOlderThan(RETENTION_DAYS());
      if (n > 0) logger.info(`Outbox purged ${n} published events`);
    } catch (error) {
      logger.warn("Outbox purge failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

let gaugesRegistered = false;
const registerOutboxGaugesOnce = (repo: OutboxRepository): void => {
  if (gaugesRegistered) return;
  gaugesRegistered = true;
  registerOutboxGauges({
    pending: () => repo.countPending(),
    dead: () => repo.countDead(),
  });
};

export const outboxRelay = new OutboxRelay();
