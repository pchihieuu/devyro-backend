import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Column,
  DeleteDateColumn,
  Index,
} from "typeorm";
import { User } from "./User.entity";
import { Job } from "./Job.entity";

/**
 * BUG FIX: savedJob.service.ts / savedJob.repository.ts rely entirely on an
 * application-level findOneWithDeleted() check before insert to prevent
 * duplicate saves — with no DB constraint, two concurrent "save" requests
 * for the same (jobId, jobseekerId) race past that check and both insert.
 * TypeORM soft-delete uses a partial-style semantics via deletedAt, so the
 * unique index is scoped with a `where` filter to only active rows —
 * generated migration must add `WHERE "deletedAt" IS NULL` (see migration).
 */
@Entity("saved_jobs")
@Index("IDX_saved_jobs_job_jobseeker_active", ["jobId", "jobseekerId"], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
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
