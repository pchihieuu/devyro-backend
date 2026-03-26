import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "./User.entity";
import { BlogCategory } from "./BlogCategory.entity";
import { BlogTag } from "./BlogTag.entity";
import { BlogPostView } from "./BlogPostView.entity";

export enum BlogPostStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

@Entity("blog_posts")
export class BlogPost {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "varchar", length: 280, unique: true })
  slug: string;

  @Column({ type: "text", nullable: true })
  excerpt: string | null; 

  @Column({ type: "text" })
  content: string;

  @Column({ type: "varchar", nullable: true })
  thumbnail: string | null; 

  @Column({ type: "enum", enum: BlogPostStatus, default: BlogPostStatus.DRAFT })
  status: BlogPostStatus;

  @Column({ type: "int", default: 0 })
  viewCount: number;

  @Column({ type: "timestamp", nullable: true })
  publishedAt: Date | null;

  // FK
  @Column({ type: "uuid" })
  authorId: string;

  @Column({ type: "uuid" })
  categoryId: string;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "authorId" })
  author: User;

  @ManyToOne(() => BlogCategory, (cat) => cat.posts, {
    onDelete: "SET NULL",
    nullable: true,
  })
  @JoinColumn({ name: "categoryId" })
  category: BlogCategory;

  @ManyToMany(() => BlogTag, (tag) => tag.posts, { cascade: true })
  @JoinTable({
    name: "blog_post_tags",
    joinColumn: { name: "postId" },
    inverseJoinColumn: { name: "tagId" },
  })
  tags: BlogTag[];

  @OneToMany(() => BlogPostView, (view) => view.post)
  views: BlogPostView[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
