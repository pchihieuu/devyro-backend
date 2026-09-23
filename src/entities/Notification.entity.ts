import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./User.entity";

export enum NotificationType {
  APPLICATION_STATUS_UPDATED = "application_status_updated",
  JOB_APPLIED = "job_applied",
  JOB_SAVED = "job_saved",
}

/**
 * PERF FIX: findManyByUser orders by (userId, createdAt DESC); countUnread
 * filters (userId, isRead). Neither had a supporting index — both were
 * sequential scans, worst offender being the "unread count" badge which
 * every screen calls.
 */
@Entity("notifications")
@Index("IDX_notifications_user_created", ["userId", "createdAt"])
@Index("IDX_notifications_user_isRead", ["userId", "isRead"])
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 500 })
  title: string;

  @Column({ type: "text" })
  message: string;

  @Column({
    type: "enum",
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({ type: "boolean", default: false })
  isRead: boolean;

  @Column({ type: "json", nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.notifications, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "uuid" })
  userId: string;
}
