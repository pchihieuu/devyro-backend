import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./User.entity";
import { GroupMessage } from "./GroupMessage.entity";

@Entity("group_message_seen")
@Index(["messageId", "userId"], { unique: true })
export class GroupMessageSeen {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "message_id" })
  messageId: string;

  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @Column({ type: "uuid", name: "group_id" })
  groupId: string;

  /**
   * Using a plain @Column with default NOW() instead of @CreateDateColumn so
   * that raw SQL inserts (INSERT … ON CONFLICT DO NOTHING) and TypeORM inserts
   * both honour the same default without discrepancies.
   */
  @Column({ type: "timestamp", default: () => "NOW()", name: "seen_at" })
  seenAt: Date;

  @ManyToOne(() => GroupMessage, (msg) => msg.seenBy, { onDelete: "CASCADE" })
  @JoinColumn({ name: "message_id" })
  message: GroupMessage;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;
}
