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

  @Column({ type: "uuid" })
  createdById: string;

  @Column({ type: "text", nullable: true })
  lastMessage: string | null;

  @Column({ type: "uuid", nullable: true })
  lastMessageSenderId: string | null;

  @Column({ type: "timestamp", nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: "createdById" })
  createdBy: User;

  @OneToMany(() => GroupMember, (member) => member.group)
  members: GroupMember[];

  @OneToMany(() => GroupMessage, (message) => message.group)
  messages: GroupMessage[];
}