import slugify from "slugify";
import { BlogPost, BlogPostStatus } from "../entities/BlogPost.entity";
import { BlogTag } from "../entities/BlogTag.entity";
import { NotFoundError } from "../utils/errors";
import {
  blogRepository,
  BlogRepository,
} from "../repositories/blog.repository";
import {
  blogCategoryRepository,
  BlogCategoryRepository,
} from "../repositories/blogCategory.repository";
import {
  AdminListPostsQuery,
  CreatePostBody,
  ListPostsQuery,
  UpdatePostBody,
} from "../validators/blog.validator";
import { SanitizedBlogPost } from "../types/blog.types";
import {
  buildPaginatedResult,
  PaginatedResult,
} from "../utils/pagination.util";

const RECENT_VIEW_WINDOW_MS = 30 * 60 * 1000;
export class BlogService {
  constructor(
    private readonly blogRepo: BlogRepository = blogRepository,
    private readonly categoryRepo: BlogCategoryRepository = blogCategoryRepository
  ) {}

  private makeSlug(text: string): string {
    return slugify(text, { lower: true, strict: true, locale: "vi" });
  }

  /**
   * Batch: 1 query lấy tag có sẵn + tối đa 1 insert + 1 query đọc lại, thay
   * cho vòng for tuần tự (2 query/tag).
   * Cũng sửa 2 lỗi của bản cũ: (1) 2 tên khác nhau cùng ra 1 slug ("C#", "C++")
   * bị push trùng tag vào bài viết → duplicate key ở bảng join; (2) 2 request
   * cùng tạo tag mới → unique-violation 500.
   */
  private async findOrCreateTags(names: string[]): Promise<BlogTag[]> {
    const wanted = new Map<string, string>(); // slug -> tên hiển thị
    for (const raw of names) {
      const name = raw.trim();
      const slug = this.makeSlug(name);
      if (slug && !wanted.has(slug)) wanted.set(slug, name);
    }
    const slugs = [...wanted.keys()];
    if (slugs.length === 0) return [];

    let tags = await this.blogRepo.findTagsBySlugs(slugs);
    const found = new Set(tags.map((t) => t.slug));
    const missing = slugs.filter((s) => !found.has(s));

    if (missing.length > 0) {
      await this.blogRepo.insertTagsIgnoreConflict(
        missing.map((slug) => ({ slug, name: wanted.get(slug)! }))
      );
      tags = await this.blogRepo.findTagsBySlugs(slugs);
    }

    const bySlug = new Map(tags.map((t) => [t.slug, t]));
    return slugs.map((s) => bySlug.get(s)).filter((t): t is BlogTag => !!t);
  }

  private async uniqueSlug(title: string, excludeId?: string): Promise<string> {
    let slug = this.makeSlug(title);
    const exists = await this.blogRepo.findBySlugIncludeDeleted(slug);

    if (exists && exists.id !== excludeId) slug = `${slug}-${Date.now()}`;

    return slug;
  }

  async listPublished(
    query: ListPostsQuery
  ): Promise<PaginatedResult<SanitizedBlogPost>> {
    const { page, limit, sortBy, order, category, tag, search } = query;
    const [posts, total] = await this.blogRepo.findPublished({
      page,
      limit,
      sortBy,
      order,
      category,
      tag,
      search,
    });
    return buildPaginatedResult(
      posts.map((p) => this.sanitizePost(p)),
      total,
      page,
      limit
    );
  }

  async adminListPosts(
    query: AdminListPostsQuery
  ): Promise<PaginatedResult<SanitizedBlogPost>> {
    const { page, limit, sortBy, order, status, search } = query;
    const [posts, total] = await this.blogRepo.findForAdmin({
      page,
      limit,
      sortBy,
      order,
      status,
      search,
    });
    return buildPaginatedResult(
      posts.map((p) => this.sanitizePost(p)),
      total,
      page,
      limit
    );
  }

  async getPostById(id: string): Promise<SanitizedBlogPost> {
    const post = await this.blogRepo.findByIdWithRelations(id);
    if (!post) throw new NotFoundError("Post not found");
    return this.sanitizePost(post);
  }

  async getBySlug(
    slug: string,
    ipAddress?: string,
    userId?: string,
    userAgent?: string
  ): Promise<SanitizedBlogPost> {
    const post = await this.blogRepo.findPublishedBySlug(slug);
    if (!post) throw new NotFoundError("Post not found");

    const wasTracked = await this.trackView(
      post.id,
      ipAddress,
      userId,
      userAgent
    );
    // Tăng cục bộ thay vì query lại DB — post.viewCount trước đó là giá trị cũ,
    // đúng +1 nếu view mới thật sự được ghi nhận. Bỏ 1 round-trip DB thừa.
    if (wasTracked) post.viewCount += 1;

    return this.sanitizePost(post);
  }

  /** @returns true nếu view mới được ghi nhận (không trùng trong 30 phút gần nhất) */
  private async trackView(
    postId: string,
    ipAddress?: string,
    userId?: string,
    userAgent?: string
  ): Promise<boolean> {
    if (!userId && !ipAddress) return false;
    const since = new Date(Date.now() - RECENT_VIEW_WINDOW_MS);

    const recent = await this.blogRepo.findRecentView(
      postId,
      since,
      userId,
      ipAddress
    );
    if (recent) return false;

    await this.blogRepo.createView({ postId, ipAddress, userId, userAgent });
    await this.blogRepo.incrementViewCount(postId);
    return true;
  }

  async getRelated(postId: string, limit = 5): Promise<SanitizedBlogPost[]> {
    const post = await this.blogRepo.findByIdWithTags(postId);
    if (!post) return [];

    const tagIds = post.tags.map((t) => t.id);
    const related = await this.blogRepo.findRelated(
      postId,
      tagIds,
      post.categoryId,
      limit
    );

    return related.map((p) => this.sanitizePost(p));
  }

  async getLatest(limit = 5) {
    const posts = await this.blogRepo.findLatestPublished(limit);
    return posts.map((p) => this.sanitizePost(p));
  }

  async createPost(
    data: CreatePostBody & { authorId: string }
  ): Promise<BlogPost> {
    const category = await this.categoryRepo.findById(data.categoryId);
    if (!category) throw new NotFoundError("Category not found");

    const slug = await this.uniqueSlug(data.title);
    const tags = await this.findOrCreateTags(data.tags);

    return this.blogRepo.create({
      title: data.title,
      slug,
      excerpt: data.excerpt,
      content: data.content,
      thumbnail: data.thumbnail,
      categoryId: data.categoryId,
      authorId: data.authorId,
      tags,
      status: data.status,
      publishedAt: data.status === BlogPostStatus.PUBLISHED ? new Date() : null,
    });
  }

  async updatePost(id: string, data: UpdatePostBody): Promise<BlogPost> {
    const post = await this.blogRepo.findByIdWithRelations(id);
    if (!post) throw new NotFoundError("Post not found");

    if (data.title && data.title !== post.title) {
      post.slug = await this.uniqueSlug(data.title, id);
      post.title = data.title;
    }
    if (data.content !== undefined) post.content = data.content;
    if (data.excerpt !== undefined) post.excerpt = data.excerpt;
    if (data.thumbnail !== undefined) post.thumbnail = data.thumbnail;
    if (data.categoryId !== undefined) post.categoryId = data.categoryId;
    if (data.tags !== undefined)
      post.tags = await this.findOrCreateTags(data.tags);

    if (data.status && data.status !== post.status) {
      post.status = data.status;
      if (data.status === BlogPostStatus.PUBLISHED && !post.publishedAt) {
        post.publishedAt = new Date();
      }
    }

    return this.blogRepo.save(post);
  }

  async deletePost(id: string): Promise<void> {
    const post = await this.blogRepo.findByIdWithRelations(id);
    if (!post) throw new NotFoundError("Post not found");
    await this.blogRepo.softDelete(id);
  }

  private sanitizePost(post: BlogPost): SanitizedBlogPost {
    // Destructure trực tiếp -> TS tự suy kiểu Omit<BlogPost,"author">, không cần "as any".
    const { author, ...rest } = post;
    return {
      ...rest,
      author: author
        ? { id: author.id, name: author.name, avatar: author.avatar }
        : null,
    };
  }
}

export const blogService = new BlogService();
