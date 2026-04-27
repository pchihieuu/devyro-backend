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
import { CallParticipant } from "./CallParticipant.entity";

export enum CallStatus {
  PENDING = "pending", // Ringing
  ACTIVE = "active", // In call
  ENDED = "ended", // Ended normally
  DECLINED = "declined", // Declined
  MISSED = "missed", // Missed
  CANCELLED = "cancelled", // Cancelled by caller
}

export enum CallType {
  VIDEO = "video",
  AUDIO = "audio",
}

// Represents one call session (1-on-1 or group)
@Entity("video_calls")
export class VideoCall {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  //roomId is used as the "room" on the signaling server (unique UUID).
  @Column({ type: "varchar", length: 255, unique: true })
  roomId: string;

  @Column({ type: "uuid" })
  initiatorId: string;

  @Column({
    type: "enum",
    enum: CallStatus,
    default: CallStatus.PENDING,
  })
  status: CallStatus;

  @Column({
    type: "enum",
    enum: CallType,
    default: CallType.VIDEO,
  })
  type: CallType;

  // The moment the first person accepts (the call actually begins)
  @Column({ type: "timestamp", nullable: true })
  startedAt: Date | null;

  // The moment the call ends
  @Column({ type: "timestamp", nullable: true })
  endedAt: Date | null;

  // Duration in seconds, null if the call hasn't ended yet
  @Column({ type: "int", nullable: true })
  durationSeconds: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: "initiatorId" })
  initiator: User;

  @OneToMany(() => CallParticipant, (p) => p.call, { cascade: true })
  participants: CallParticipant[];
}
