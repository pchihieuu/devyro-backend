import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "./User.entity";
import { Group } from "./Group.entity";
import { GroupMessageSeen } from "./GroupMessageSeen.entity";

export enum MessageType {
  TEXT = "text",
  IMAGE = "image",
  FILE = "file",
  VIDEO = "video",
}

@Entity("group_messages")
export class GroupMessage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  groupId: string;

  @Column({ type: "uuid" })
  senderId: string;

  @Column({ type: "text", nullable: true })
  content: string | null;

  @Column({
    type: "enum",
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  @Column({ type: "varchar", nullable: true })
  fileUrl: string | null;

  @Column({ type: "varchar", nullable: true })
  filePublicId: string | null;

  @Column({ type: "varchar", nullable: true })
  fileName: string | null;

  @Column({ type: "int", nullable: true })
  fileSize: number | null;

  @Column({ type: "varchar", nullable: true })
  fileMimeType: string | null;

  @Column({ type: "uuid", nullable: true })
  replyToId: string | null;

  @Column({ type: "boolean", default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Group, (group) => group.messages, { onDelete: "CASCADE" })
  @JoinColumn({ name: "groupId" })
  group: Group;

  @ManyToOne(() => User)
  @JoinColumn({ name: "senderId" })
  sender: User;

  @ManyToOne(() => GroupMessage, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "replyToId" })
  replyTo: GroupMessage | null;

  @OneToMany(() => GroupMessageSeen, (seen) => seen.message)
  seenBy: GroupMessageSeen[];
}
