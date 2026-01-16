import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  OneToMany,
} from "typeorm";
import * as bcrypt from "bcryptjs";
import { Job } from "./Job.entity";
import { Application } from "./Application.entity";
import { SavedJob } from "./SavedJob.entity";

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

  // Employer fields
  @Column({ type: "varchar", nullable: true })
  companyName: string;

  @Column({ type: "text", nullable: true })
  companyDescription: string;

  @Column({ type: "varchar", nullable: true })
  companyLogo: string;

  @Column({ type: "varchar", nullable: true })
  companySize: string;

  @Column({ type: "varchar", nullable: true })
  companyIndustry: string;

  @Column({ type: "varchar", nullable: true })
  companyAddress: string;

  @Column({ type: "varchar", nullable: true })
  companyWebsite: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @CreateDateColumn()
  deletedAt: Date;

  // Relations
  @OneToMany(() => Job, (job) => job.company)
  jobs: Job[];

  @OneToMany(() => Application, (application) => application.applicant)
  applications: Application[];

  @OneToMany(() => SavedJob, (savedJob) => savedJob.jobseeker)
  savedJobs: SavedJob[];

  // Methods
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith("$2a$")) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }

  async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
  }
}
