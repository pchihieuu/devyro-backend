import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  OneToOne,
} from "typeorm";
import { Job } from "./Job.entity";
import { Application } from "./Application.entity";
import { SavedJob } from "./SavedJob.entity";
import { Company } from "./Company.entity";

export enum UserRole {
  JOBSEEKER = "jobseeker",
  EMPLOYER = "employer",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  @Column({ type: "varchar", length: 255 })
  password: string;

  @Column({
    type: "enum",
    enum: UserRole,
  })
  role: UserRole;

  @Column({ type: "varchar", nullable: true })
  avatar: string;

  @Column({ type: "varchar", nullable: true })
  resume: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  // Relations
  @OneToMany(() => Job, (job) => job.company)
  jobs: Job[];

  @OneToMany(() => Application, (application) => application.applicant)
  applications: Application[];

  @OneToMany(() => SavedJob, (savedJob) => savedJob.jobseeker)
  savedJobs: SavedJob[];

  @OneToOne(() => Company, (company) => company.employer)
  company: Company;
}