import { EntityManager } from "typeorm";
import { AppDataSource } from "../config/database.config";
import { OutboxEvent } from "../entities/OutboxEvent.entity";

/** Event đã được relay "mượn" (lease) để xử lý. */
export type ClaimedOutboxEvent = Pick<
  OutboxEvent,
  "id" | "topic" | "payload" | "attempts"
>;

export class OutboxRepository {
  /**
   * Ghi event bằng manager của transaction đang chạy — đây là điểm mấu chốt:
   * event chỉ tồn tại nếu transaction nghiệp vụ commit thành công.
   */
  async enqueue(
    manager: EntityManager,
    topic: string,
    payload: unknown
  ): Promise<void> {
    await manager.insert(OutboxEvent, { topic, payload: payload as object });
  }

  /**
   * Lấy tối đa `limit` event đến hạn và đặt lease `leaseSeconds` giây trong 1
   * câu UPDATE (FOR UPDATE SKIP LOCKED → nhiều instance không lấy trùng, không
   * cần giữ transaction mở trong lúc publish). `attempts` tăng ngay khi lấy:
   * relay crash giữa chừng vẫn được tính 1 lần thử, event không retry vô hạn.
   */
  async claimDue(limit: number, leaseSeconds: number): Promise<ClaimedOutboxEvent[]> {
    // Driver Postgres của TypeORM trả UPDATE ... RETURNING dạng [rows, rowCount].
    const [rows]: [ClaimedOutboxEvent[], number] = await AppDataSource.query(
      `
      UPDATE outbox_events
      SET attempts = attempts + 1,
          locked_until = NOW() + make_interval(secs => $2)
      WHERE id IN (
        SELECT id FROM outbox_events
        WHERE published_at IS NULL
          AND dead_at IS NULL
          AND next_attempt_at <= NOW()
          AND (locked_until IS NULL OR locked_until < NOW())
        ORDER BY id
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, topic, payload, attempts
      `,
      [limit, leaseSeconds]
    );
    return this.sortById(rows);
  }

  /**
   * UPDATE ... RETURNING không đảm bảo thứ tự → sắp lại theo id để giữ thứ tự
   * gửi (id là bigint dạng string: so sánh độ dài trước rồi mới đến chữ).
   */
  private sortById(rows: ClaimedOutboxEvent[]): ClaimedOutboxEvent[] {
    return [...rows].sort((a, b) =>
      a.id.length !== b.id.length ? a.id.length - b.id.length : a.id < b.id ? -1 : 1
    );
  }

  async markPublished(id: string): Promise<void> {
    await AppDataSource.query(
      `UPDATE outbox_events SET published_at = NOW(), locked_until = NULL, last_error = NULL WHERE id = $1`,
      [id]
    );
  }

  /** Lên lịch thử lại với backoff, hoặc đánh dấu dead nếu đã hết lượt. */
  async markFailed(
    id: string,
    error: string,
    retryInSeconds: number,
    dead: boolean
  ): Promise<void> {
    await AppDataSource.query(
      `
      UPDATE outbox_events
      SET last_error = $2,
          locked_until = NULL,
          next_attempt_at = NOW() + make_interval(secs => $3),
          dead_at = CASE WHEN $4 THEN NOW() ELSE NULL END
      WHERE id = $1
      `,
      [id, error.slice(0, 2000), retryInSeconds, dead]
    );
  }

  async purgePublishedOlderThan(days: number): Promise<number> {
    const [, affected]: [unknown, number] = await AppDataSource.query(
      `DELETE FROM outbox_events WHERE published_at IS NOT NULL AND published_at < NOW() - make_interval(days => $1)`,
      [days]
    );
    return affected ?? 0;
  }

  async countPending(): Promise<number> {
    const [row]: Array<{ n: string }> = await AppDataSource.query(
      `SELECT COUNT(*)::text AS n FROM outbox_events WHERE published_at IS NULL AND dead_at IS NULL`
    );
    return Number(row?.n ?? 0);
  }

  async countDead(): Promise<number> {
    const [row]: Array<{ n: string }> = await AppDataSource.query(
      `SELECT COUNT(*)::text AS n FROM outbox_events WHERE dead_at IS NOT NULL`
    );
    return Number(row?.n ?? 0);
  }
}

export const outboxRepository = new OutboxRepository();
