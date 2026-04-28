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

  @Column({ type: "uuid" })
  groupId: string;

  @Column({ type: "uuid" })
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

  @Column({ type: "int", default: 0 })
  unreadCount: number;

  @Column({ type: "timestamp", nullable: true })
  lastReadAt: Date | null;

  @Column({ type: "timestamp", nullable: true })
  invitedAt: Date | null;

  @Column({ type: "uuid", nullable: true })
  invitedById: string | null;

  @Column({ type: "timestamp", nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn()
  joinedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Group, (group) => group.members, { onDelete: "CASCADE" })
  @JoinColumn({ name: "groupId" })
  group: Group;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "invitedById" })
  invitedBy: User | null;
}
