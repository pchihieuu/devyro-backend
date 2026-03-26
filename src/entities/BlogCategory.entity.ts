import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { BlogPost } from "./BlogPost.entity";

export enum BlogCategoryType {
  PORTAL_NEWS = "portal_news",
  INDUSTRY_NEWS = "industry_news",
}

@Entity("blog_categories")
export class BlogCategory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "varchar", length: 255, unique: true })
  slug: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "enum", enum: BlogCategoryType })
  type: BlogCategoryType;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => BlogPost, (post) => post.category)
  posts: BlogPost[];
}
