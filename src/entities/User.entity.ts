import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  OneToOne,
  Index,
} from "typeorm";
import { Job } from "./Job.entity";
import { Application } from "./Application.entity";
import { SavedJob } from "./SavedJob.entity";
import { Company } from "./Company.entity";
import { Notification } from "./Notification.entity";

export enum UserRole {
  JOBSEEKER = "jobseeker",
  EMPLOYER = "employer",
  ADMIN = "admin",
}

export enum WorkPreference {
  ONSITE = "onsite",
  REMOTE = "remote",
  HYBRID = "hybrid",
}

export enum AvailabilityStatus {
  AVAILABLE = "available",
  BUSY = "busy",
  UNAVAILABLE = "unavailable",
}

export interface Experience {
  id: string;
  title: string;
  company: string;
  companyLink?: string;
  description: string;
  startDate: string;
  endDate?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  link?: string;
  image?: string;
}

@Entity("users")
@Index("IDX_users_skills_gin", { synchronize: false })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  @Column({ type: "varchar", length: 255, select: false })
  password: string;

  @Column({
    type: "enum",
    enum: UserRole,
  })
  role: UserRole;

  @Column({ type: "varchar", nullable: true })
  avatar: string | null;

  @Column({ type: "varchar", nullable: true })
  resume: string | null;

  // New profile fields
  @Column({ type: "varchar", length: 50, unique: true, nullable: true })
  username: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  title: string | null;

  @Column({ type: "text", nullable: true })
  bio: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  location: string | null;

  @Column({
    type: "enum",
    enum: WorkPreference,
    nullable: true,
  })
  workPreference: WorkPreference | null;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  hourlyRateMin: number | null;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  hourlyRateMax: number | null;

  @Column({ type: "int", default: 0 })
  completionRate: number;

  @Column({ type: "int", default: 0 })
  totalProjects: number;

  @Column({ type: "int", default: 2 })
  responseTimeHours: number;

  @Column({
    type: "enum",
    enum: AvailabilityStatus,
    default: AvailabilityStatus.AVAILABLE,
  })
  availabilityStatus: AvailabilityStatus;

  @Column({ type: "text", array: true, nullable: true, default: null })
  skills: string[];

  @Column({ type: "json", nullable: true })
  experience: Experience[];

  @Column({ type: "json", nullable: true })
  projects: Project[];

  @Column({ type: "decimal", precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ type: "int", default: 0 })
  reviewCount: number;

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

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];
}
