import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { VideoCall } from "./Videocall.entity";
import { User } from "./User.entity";

// Track each person in the call (including the initiator).
export enum ParticipantStatus {
  INVITED = "invited",     // Invite sent, no response yet.
  JOINED = "joined",       // In call
  LEFT = "left",           // Left
  DECLINED = "declined",   // Declined
  MISSED = "missed",       // Missed
}

@Entity("call_participants")
export class CallParticipant {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  callId: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({
    type: "enum",
    enum: ParticipantStatus,
    default: ParticipantStatus.INVITED,
  })
  status: ParticipantStatus;

  @Column({ type: "timestamp", nullable: true })
  joinedAt: Date | null;

  @Column({ type: "timestamp", nullable: true })
  leftAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => VideoCall, (call) => call.participants)
  @JoinColumn({ name: "callId" })
  call: VideoCall;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user: User;
}