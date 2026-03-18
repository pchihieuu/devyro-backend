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
  Index,
} from "typeorm";
import { Application } from "./Application.entity";
import { SavedJob } from "./SavedJob.entity";
import { Company } from "./Company.entity";

export enum JobType {
  FULL_TIME = "Full-time",
  PART_TIME = "Part-time",
  CONTRACT = "Contract",
  INTERNSHIP = "Internship",
  FREELANCE = "Freelance",
  REMOTE = "Remote",
  HYBRID = "Hybrid",
}

export enum JobLevel {
  INTERN = "Intern",
  FRESHER = "Fresher",
  JUNIOR = "Junior",
  MIDDLE = "Middle",
  SENIOR = "Senior",
  LEAD = "Lead",
}

@Entity("jobs")
@Index(["title", "location", "category"])
export class Job {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 500 })
  @Index()
  title: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "text" })
  requirement: string;

  @Column({ type: "varchar", length: 255 })
  @Index()
  location: string;

  @Column({ type: "varchar", length: 255 })
  @Index()
  category: string;

  @Column({
    type: "enum",
    enum: JobType,
  })
  @Index()
  type: JobType;

  @Column({
    type: "enum",
    enum: JobLevel,
    nullable: true,
  })
  @Index()
  level: JobLevel;

  @Column({ type: "decimal", precision: 14, scale: 2, nullable: true })
  @Index()
  salaryMin: number;

  @Column({ type: "decimal", precision: 14, scale: 2, nullable: true })
  @Index()
  salaryMax: number;

  @Column({ type: "simple-array", nullable: true, default: null })
  skills: string[];

  @Column({ type: "boolean", default: false })
  @Index()
  isClosed: boolean;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;

  @ManyToOne(() => Company, (company) => company.jobs, { onDelete: "CASCADE" })
  @JoinColumn({ name: "companyId" })
  company: Company;

  @Column({ type: "uuid" })
  @Index()
  companyId: string;

  @OneToMany(() => Application, (application) => application.job)
  applications: Application[];

  @OneToMany(() => SavedJob, (savedJob) => savedJob.job)
  savedJobs: SavedJob[];
}
