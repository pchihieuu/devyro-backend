import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
  Index,
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
/**
 * BUG FIX: no DB-level constraint previously stopped 2 rows for the same
 * (group_id, user_id) pair — addMembers()/createGroup() only guard against
 * this in application code, so a race (2 concurrent addMembers calls) could
 * insert a duplicate membership row. Unique index closes that gap.
 * Second index supports assertActiveMember/assertAdmin's hot-path lookup
 * `where: { userId, groupId, status: ACTIVE }`, which currently table-scans.
 */
@Entity("group_members")
@Index("IDX_group_members_group_user", ["groupId", "userId"], { unique: true })
@Index("IDX_group_members_group_status", ["groupId", "status"])
@Index("IDX_group_members_user_status", ["userId", "status"])
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
