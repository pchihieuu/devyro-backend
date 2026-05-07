import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { User } from "./User.entity";
import { GroupMember } from "./GroupMember.entity";
import { GroupMessage } from "./GroupMessage.entity";

@Entity("groups")
export class Group {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "varchar", nullable: true })
  avatar: string | null;

  @Column({ type: "uuid", name: "created_by_id" })
  createdById: string;

  @Column({ type: "text", nullable: true, name: "last_message" })
  lastMessage: string | null;

  @Column({ type: "uuid", nullable: true, name: "last_message_sender_id" })
  lastMessageSenderId: string | null;

  @Column({ type: "timestamp", nullable: true, name: "last_message_at" })
  lastMessageAt: Date | null;

  /**
   * Denormalized active member count — incremented/decremented atomically
   * via UPDATE … SET member_count = member_count ± 1.
   * Avoids a COUNT(*) query every time getUserGroups is called.
   */
  @Column({ type: "int", default: 0, name: "member_count" })
  memberCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by_id" })
  createdBy: User;

  @OneToMany(() => GroupMember, (member) => member.group)
  members: GroupMember[];

  @OneToMany(() => GroupMessage, (message) => message.group)
  messages: GroupMessage[];
}
