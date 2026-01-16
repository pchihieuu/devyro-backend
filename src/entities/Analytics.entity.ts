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

@Entity("analytics")
export class Analytics {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "int", default: 0 })
  totalJobsPosted: number;

  @Column({ type: "int", default: 0 })
  totalApplicationsReceived: number;

  @Column({ type: "int", default: 0 })
  totalHired: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "employerId" })
  employer: User;

  @Column({ type: "uuid" })
  employerId: string;
}
