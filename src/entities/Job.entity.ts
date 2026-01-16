import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  DeleteDateColumn,
} from "typeorm";
import { User } from "./User.entity";
import { Application } from "./Application.entity";
import { SavedJob } from "./SavedJob.entity";

export enum JobType {
  FULL_TIME = "Full-time",
  PART_TIME = "Part-time",
  CONTRACT = "Contract",
  INTERNSHIP = "Internship",
  FREELANCE = "Freelance",
  REMOTE = "Remote",
  HYBRID = "Hybrid",
}

@Entity("jobs")
export class Job {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 500 })
  title: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "text" })
  requirement: string;

  @Column({ type: "varchar", length: 255 })
  location: string;

  @Column({ type: "varchar", length: 255 })
  category: string;

  @Column({
    type: "enum",
    enum: JobType,
  })
  type: JobType;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  salaryMin: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  salaryMax: number;

  @Column({ type: "boolean", default: false })
  isClosed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
  
  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.jobs, { onDelete: "CASCADE" })
  @JoinColumn({ name: "companyId" })
  company: User;

  @Column({ type: "uuid" })
  companyId: string;

  @OneToMany(() => Application, (application) => application.job)
  applications: Application[];

  @OneToMany(() => SavedJob, (savedJob) => savedJob.job)
  savedJobs: SavedJob[];
}
