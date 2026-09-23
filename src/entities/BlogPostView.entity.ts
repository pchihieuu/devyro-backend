import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { BlogPost } from "./BlogPost.entity";

/**
 * PERF FIX: findRecentView() (dedupe window for view counting) filters on
 * (postId, viewedAt) — and userId/ipAddress on top — every single time a
 * blog post is opened. No index previously existed on this table at all.
 */
@Entity("blog_post_views")
@Index("IDX_blog_post_views_post_viewed", ["postId", "viewedAt"])
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
