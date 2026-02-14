import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User.entity";

export enum MessageType {
  TEXT = "text",
  IMAGE = "image",
  FILE = "file",
}

@Entity("messages")
export class Message {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  senderId: string;

  @Column({ type: "uuid" })
  receiverId: string;

  @Column({ type: "text" })
  content: string;

  @Column({
    type: "enum",
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  @Column({ type: "varchar", nullable: true })
  fileUrl: string | null;

  @Column({ type: "boolean", default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: "senderId" })
  sender: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "receiverId" })
  receiver: User;
}