// src/services/blog.service.ts
import slugify from "slugify";
import { BlogRepository } from "../repositories/blog.repository";
import { BlogSearchQuery } from "../queries/BlogSearchQuery";
import { BlogPost, BlogPostStatus } from "../entities/BlogPost.entity";
import { BlogCategory } from "../entities/BlogCategory.entity";
import { AppDataSource } from "../config/database.config";
import { NotFoundError } from "../utils/errors";

export class BlogService {
  private categoryRepo = AppDataSource.getRepository(BlogCategory);

  constructor(
    private readonly blogRepo: BlogRepository,
    private readonly viewTracker: ViewTrackingService
  ) {}

  // helpers
  private makeSlug(text: string): string {
    return slugify(text, { lower: true, strict: true, locale: "vi" });
  }

  private async uniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = this.makeSlug(title);
    const taken = await this.blogRepo.slugExists(base, excludeId);
    return taken ? `${base}-${Date.now()}` : base;
  }

  private sanitizePost(post: BlogPost) {
    const { author, ...rest } = post as any;
    return {
      ...rest,
      author: author
        ? { id: author.id, name: author.name, avatar: author.avatar }
        : null,
    };
  }

  private paginate(total: number, page: number, limit: number) {
    return { total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // public
  async listPublished(filter: {
    page: number;
    limit: number;
    category?: string;
    tag?: string;
    search?: string;
  }) {
    const qb = this.blogRepo.basePublishedQB();
    const [posts, total] = await new BlogSearchQuery(qb, filter).execute();

    return {
      posts: posts.map((p) => this.sanitizePost(p)),
      ...this.paginate(total, filter.page, filter.limit),
    };
  }

  async getBySlug(slug: string, ipAddress?: string, userId?: string, userAgent?: string) {
    const post = await this.blogRepo.findPublishedBySlug(slug);
    if (!post) throw new NotFoundError("Post not found");

    // Separate side effects, no blocking of responses.
    this.viewTracker.trackAsync(post.id, ipAddress, userId, userAgent);

    return this.sanitizePost(post);
  }

  async getRelated(postId: string, limit = 5) {
    const post = await this.blogRepo.findById(postId);
    if (!post) return [];

    const tagIds = post.tags.map((t) => t.id);

    const qb = this.blogRepo
      .basePublishedQB()
      .andWhere("post.id != :id", { id: postId });

    if (tagIds.length) {
      qb.andWhere("tags.id IN (:...tagIds)", { tagIds });
    } else {
      qb.andWhere("category.id = :catId", { catId: (post as any).categoryId });
    }

    const related = await qb.orderBy("post.viewCount", "DESC").take(limit).getMany();
    return related.map((p) => this.sanitizePost(p));
  }

  async getLatest(limit = 5) {
    const posts = await this.blogRepo
      .basePublishedQB()
      .orderBy("post.publishedAt", "DESC")
      .take(limit)
      .getMany();
    return posts.map((p) => this.sanitizePost(p));
  }

  // admin
  async adminListPosts(filter: {
    page: number;
    limit: number;
    status?: BlogPostStatus;
    search?: string;
  }) {
    // Admin QB: no filter, status=PUBLISHED by default.
    const qb = this.blogRepo
      .getRepo()
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.category", "category")
      .leftJoinAndSelect("post.tags", "tags")
      .orderBy("post.createdAt", "DESC");

    const [posts, total] = await new BlogSearchQuery(qb, filter).execute();
    return { posts, ...this.paginate(total, filter.page, filter.limit) };
  }

  async createPost(data: {
    title: string;
    content: string;
    categoryId: string;
    authorId: string;
    tags?: string[];
    excerpt?: string;
    thumbnail?: string;
    status?: BlogPostStatus;
  }) {
    const category = await this.categoryRepo.findOne({ where: { id: data.categoryId } });
    if (!category) throw new NotFoundError("Category not found");

    const [slug, tags] = await Promise.all([
      this.uniqueSlug(data.title),
      this.blogRepo.upsertTags(data.tags ?? [], this.makeSlug.bind(this)),
    ]);

    const post = this.blogRepo.create({
      title: data.title,
      slug,
      excerpt: data.excerpt,
      content: data.content,
      thumbnail: data.thumbnail,
      categoryId: data.categoryId,
      authorId: data.authorId,
      tags,
      status: data.status ?? BlogPostStatus.DRAFT,
      publishedAt: data.status === BlogPostStatus.PUBLISHED ? new Date() : null,
    });

    return this.blogRepo.save(post);
  }

  async updatePost(
    id: string,
    data: Partial<{
      title: string;
      content: string;
      categoryId: string;
      tags: string[];
      excerpt: string;
      thumbnail: string | null;
      status: BlogPostStatus;
    }>
  ) {
    const post = await this.blogRepo.findById(id);
    if (!post) throw new NotFoundError("Post not found");

    if (data.title && data.title !== post.title) {
      post.slug = await this.uniqueSlug(data.title, id);
      post.title = data.title;
    }
    if (data.content   !== undefined) post.content   = data.content;
    if (data.excerpt   !== undefined) post.excerpt   = data.excerpt;
    if (data.thumbnail !== undefined) post.thumbnail = data.thumbnail;
    if (data.categoryId !== undefined) post.categoryId = data.categoryId;

    if (data.tags !== undefined) {
      post.tags = await this.blogRepo.upsertTags(data.tags, this.makeSlug.bind(this));
    }

    if (data.status && data.status !== post.status) {
      post.status = data.status;
      if (data.status === BlogPostStatus.PUBLISHED && !post.publishedAt) {
        post.publishedAt = new Date();
      }
    }

    return this.blogRepo.save(post);
  }

  async deletePost(id: string) {
    const post = await this.blogRepo.findById(id);
    if (!post) throw new NotFoundError("Post not found");
    await this.blogRepo.softDelete(id);
  }
}

// Singleton wiring
import { blogRepository } from "../repositories/blog.repository";
import { ViewTrackingService } from "./viewTracking.service";
const viewTracker = new ViewTrackingService(blogRepository);
export const blogService = new BlogService(blogRepository, viewTracker);