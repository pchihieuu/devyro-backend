import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
} from "typeorm";
import { User } from "./User.entity";
import { Job } from "./Job.entity";

export enum ApplicationStatus {
  APPLIED = "Applied",
  IN_REVIEW = "In Review",
  REJECTED = "Rejected",
  ACCEPTED = "Accepted",
}

@Entity("applications")
export class Application {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", nullable: true })
  resume: string;

  @Column({
    type: "enum",
    enum: ApplicationStatus,
    default: ApplicationStatus.APPLIED,
  })
  status: ApplicationStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
  // Relations
  @ManyToOne(() => Job, (job) => job.applications, { onDelete: "CASCADE" })
  @JoinColumn({ name: "jobId" })
  job: Job;

  @Column({ type: "uuid" })
  jobId: string;

  @ManyToOne(() => User, (user) => user.applications, { onDelete: "CASCADE" })
  @JoinColumn({ name: "applicantId" })
  applicant: User;

  @Column({ type: "uuid" })
  applicantId: string;
}
