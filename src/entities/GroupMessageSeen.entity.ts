import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
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

  @Column({ type: "uuid" })
  messageId: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "uuid" })
  groupId: string;

  @CreateDateColumn()
  seenAt: Date;

  @ManyToOne(() => GroupMessage, (msg) => msg.seenBy, { onDelete: "CASCADE" })
  @JoinColumn({ name: "messageId" })
  message: GroupMessage;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user: User;
}