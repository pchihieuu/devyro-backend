import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/**
 * Transactional outbox: sự kiện cần publish ra RabbitMQ được ghi vào bảng này
 * CÙNG TRANSACTION với thay đổi dữ liệu nghiệp vụ. Relay (workers/outbox-relay)
 * đọc ra và publish sau — nên process crash giữa "lưu DB" và "publish MQ" không
 * còn làm mất event. Ngữ nghĩa giao: at-least-once (consumer phải chịu được
 * trùng, vd dedupe theo message.id).
 *
 * `id` là bigint tăng dần → dùng làm thứ tự gửi (ORDER BY id).
 */
@Entity("outbox_events")
// Partial index: chỉ chứa event còn phải xử lý nên luôn nhỏ dù bảng lớn dần.
@Index("IDX_outbox_events_pending", ["nextAttemptAt"], {
  where: '"published_at" IS NULL AND "dead_at" IS NULL',
})
@Index("IDX_outbox_events_published_at", ["publishedAt"])
export class OutboxEvent {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: string; // pg trả bigint dạng string

  @Column({ type: "varchar", length: 100 })
  topic: string;

  @Column({ type: "jsonb" })
  payload: unknown;

  @Column({ type: "int", default: 0 })
  attempts: number;

  @Column({ type: "timestamptz", name: "next_attempt_at", default: () => "NOW()" })
  nextAttemptAt: Date;

  /** Lease: relay đang xử lý event này đến thời điểm này (chống 2 relay lấy trùng). */
  @Column({ type: "timestamptz", name: "locked_until", nullable: true })
  lockedUntil: Date | null;

  @Column({ type: "timestamptz", name: "published_at", nullable: true })
  publishedAt: Date | null;

  /** Vượt số lần thử tối đa → dừng retry, chờ người xử lý (xem metric/log). */
  @Column({ type: "timestamptz", name: "dead_at", nullable: true })
  deadAt: Date | null;

  @Column({ type: "text", name: "last_error", nullable: true })
  lastError: string | null;

  @Column({ type: "timestamptz", name: "created_at", default: () => "NOW()" })
  createdAt: Date;
}
