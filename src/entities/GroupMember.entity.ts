import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User.entity";
import { Group } from "./Group.entity";

export enum GroupRole {
  ADMIN = "admin",
  MEMBER = "member",
}
export enum MemberStatus {
  PENDING = "pending",
  ACTIVE = "active",
  REJECTED = "rejected",
  LEFT = "left",
  KICKED = "kicked",
}
@Entity("group_members")
export class GroupMember {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "group_id" })
  groupId: string;

  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @Column({
    type: "enum",
    enum: GroupRole,
    default: GroupRole.MEMBER,
  })
  role: GroupRole;

  @Column({
    type: "enum",
    enum: MemberStatus,
    default: MemberStatus.PENDING,
  })
  status: MemberStatus;

  @Column({ type: "int", default: 0, name: "unread_count" })
  unreadCount: number;

  @Column({ type: "timestamp", nullable: true, name: "last_read_at" })
  lastReadAt: Date | null;

  @Column({ type: "timestamp", nullable: true, name: "invited_at" })
  invitedAt: Date | null;

  @Column({ type: "uuid", nullable: true, name: "invited_by_id" })
  invitedById: string | null;

  @Column({ type: "timestamp", nullable: true, name: "responded_at" })
  respondedAt: Date | null;

  @CreateDateColumn()
  joinedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Group, (group) => group.members, { onDelete: "CASCADE" })
  @JoinColumn({ name: "group_id" })
  group: Group;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "invited_by_id" })
  invitedBy: User | null;
}
