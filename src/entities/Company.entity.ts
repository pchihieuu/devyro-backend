// src/entities/Company.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
  DeleteDateColumn,
} from "typeorm";
import { User } from "./User.entity";
import { Job } from "./Job.entity";

@Entity("companies")
export class Company {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  logo: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  size: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  industry: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  address: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  website: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  foundedYear: string;

  @Column({ type: "simple-array", nullable: true })
  benefits: string[];

  @Column({ type: "int", default: 0 })
  totalJobs: number;

  @Column({ type: "int", default: 0 })
  activeJobs: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;

  // Relations
  @OneToOne(() => User, (user) => user.company, { onDelete: "CASCADE" })
  @JoinColumn({ name: "employerId" })
  employer: User;

  @Column({ type: "uuid", unique: true })
  employerId: string;

  @OneToMany(() => Job, (job) => job.company)
  jobs: Job[];
}
