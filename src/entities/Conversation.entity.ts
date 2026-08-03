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

/**
 * Bất biến: user1Id luôn là UUID nhỏ hơn user2Id khi so sánh string (chuẩn hoá
 * bởi ConversationRepository.normalizeUserPair()). Không tự tạo Conversation
 * bằng repo.create({ user1Id, user2Id }) ở nơi khác — luôn đi qua
 * findOrCreateConversation() để giữ đúng thứ tự này, nếu không unique index
 * bên dưới sẽ không chặn được conversation trùng khi 2 user nhắn cho nhau
 * theo 2 chiều khác nhau.
 */
@Entity("conversations")
@Index("IDX_conversations_user1Id_user2Id", ["user1Id", "user2Id"], {
  unique: true,
})
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