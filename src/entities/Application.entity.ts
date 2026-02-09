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

export interface AIMatchingAnalysis {
  score: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  skillsMatch: {
    matched: string[];
    missing: string[];
    matchPercentage: number;
  };
  experienceMatch: {
    summary: string;
    yearsRequired?: number;
    yearsCandidate?: number;
    isMatch: boolean;
  };
  educationMatch: {
    summary: string;
    isMatch: boolean;
  };
  overallAssessment: string;
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

  @Column({ 
    type: "decimal", 
    precision: 5, 
    scale: 2, 
    nullable: true,
    comment: "AI-generated matching score (0-100)"
  })
  aiMatchingScore: number;

  @Column({ 
    type: "jsonb", 
    nullable: true,
    comment: "Detailed AI analysis"
  })
  aiMatchingAnalysis: AIMatchingAnalysis;

  @Column({ 
    type: "timestamp", 
    nullable: true,
    comment: "Timestamp when AI analysis was performed"
  })
  aiAnalyzedAt: Date;

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