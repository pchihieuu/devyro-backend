import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Column,
  DeleteDateColumn,
} from "typeorm";
import { User } from "./User.entity";
import { Job } from "./Job.entity";

@Entity("saved_jobs")
export class SavedJob {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
  @DeleteDateColumn()
  deletedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.savedJobs, { onDelete: "CASCADE" })
  @JoinColumn({ name: "jobseekerId" })
  jobseeker: User;

  @Column({ type: "uuid" })
  jobseekerId: string;

  @ManyToOne(() => Job, (job) => job.savedJobs, { onDelete: "CASCADE" })
  @JoinColumn({ name: "jobId" })
  job: Job;

  @Column({ type: "uuid" })
  jobId: string;
}
