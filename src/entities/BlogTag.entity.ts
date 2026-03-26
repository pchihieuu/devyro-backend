import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { BlogPost } from "./BlogPost.entity";

@Entity("blog_tags")
export class BlogTag {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 100, unique: true })
  name: string;

  @Column({ type: "varchar", length: 100, unique: true })
  slug: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToMany(() => BlogPost, (post) => post.tags)
  posts: BlogPost[];
}
