import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User.entity";

@Entity("conversations")
export class Conversation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  user1Id: string;

  @Column({ type: "uuid" })
  user2Id: string;

  @Column({ type: "text", nullable: true })
  lastMessage: string | null;

  @Column({ type: "uuid", nullable: true })
  lastMessageSenderId: string | null;

  @Column({ type: "timestamp", nullable: true })
  lastMessageAt: Date | null;

  @Column({ type: "int", default: 0 })
  user1UnreadCount: number;

  @Column({ type: "int", default: 0 })
  user2UnreadCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user1Id" })
  user1: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user2Id" })
  user2: User;
}