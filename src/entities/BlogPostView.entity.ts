import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from "typeorm";
import { BlogPost } from "./BlogPost.entity";

@Entity("blog_post_views")
export class BlogPostView {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  postId: string;

  @Column({ type: "varchar", length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: "varchar", nullable: true })
  userAgent: string | null;

  @Column({ type: "uuid", nullable: true })
  userId: string | null;
  
  @CreateDateColumn()
  viewedAt: Date;

  @ManyToOne(() => BlogPost, (post) => post.views, { onDelete: "CASCADE" })
  @JoinColumn({ name: "postId" })
  post: BlogPost;
}