import slugify from "slugify";
import { AppDataSource } from "../config/database.config";
import { BlogCategory } from "../entities/BlogCategory.entity";
import { BlogPost, BlogPostStatus } from "../entities/BlogPost.entity";
import { BlogPostView } from "../entities/BlogPostView.entity";
import { BlogTag } from "../entities/BlogTag.entity";
import { NotFoundError } from "../utils/errors";

export class BlogService {
  private postRepository = AppDataSource.getRepository(BlogPost);
  private tagRepository = AppDataSource.getRepository(BlogTag);
  private viewRepository = AppDataSource.getRepository(BlogPostView);
  private categoryRepository = AppDataSource.getRepository(BlogCategory);

  private makeSlug(text: string): string {
    return slugify(text, { lower: true, strict: true, locale: "vi" });
  }

  private async findOrCreateTags(names: string[]): Promise<BlogTag[]> {
    const tags: BlogTag[] = [];
    for (const name of names) {
      const slug = this.makeSlug(name);
      let tag = await this.tagRepository.findOne({ where: { slug } });
      if (!tag) {
        tag = this.tagRepository.create({ name: name.trim(), slug });
        await this.tagRepository.save(tag);
      }
      tags.push(tag);
    }
    return tags;
  }

  private async uniqueSlug(title: string, excludeId?: string): Promise<string> {
    let slug = this.makeSlug(title);
    const exists = await this.postRepository.findOne({
      where: { slug },
      withDeleted: true,
    });

    if (exists && exists.id !== excludeId) {
      slug = `${slug}-${Date.now()}`;
    }
    return slug;
  }

  async listPublished(query: {
    page: number;
    limit: number;
    category?: string;
    tag?: string;
    search?: string;
  }) {
    const { page, limit, category, tag, search } = query;
    const qb = this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.category", "category")
      .leftJoinAndSelect("post.tags", "tags")
      .leftJoinAndSelect("post.author", "author")
      .where("post.status = :status", { status: BlogPostStatus.PUBLISHED })
      .orderBy("post.publishedAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (category) {
      qb.andWhere("category.slug = :category", { category });
    }
    if (tag) {
      qb.andWhere("tags.slug = :tag", { tag });
    }
    if (search) {
      qb.andWhere("(post.title ILIKE :s OR post.excerpt ILIKE :s)", {
        s: `%${search}%`,
      });
    }
    const [posts, total] = await qb.getManyAndCount();
    return {
      posts: posts.map((p) => this.sanitizePost(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPostById(id: string) {
    const post = await this.postRepository.findOne({
      where: { id },
      relations: ["category", "tags", "author"],
    });
    if (!post) throw new NotFoundError("Post not found");
    return this.sanitizePost(post);
  }

  async getBySlug(
    slug: string,
    ipAddress?: string,
    userId?: string,
    userAgent?: string
  ) {
    const post = await this.postRepository.findOne({
      where: { slug, status: BlogPostStatus.PUBLISHED },
      relations: ["category", "tags", "author"],
    });
    if (!post) throw new NotFoundError("Post not found");

    await this.trackView(post.id, ipAddress, userId, userAgent);
    const updated = await this.postRepository.findOne({
      where: { id: post.id },
    });
    post.viewCount = updated?.viewCount ?? post.viewCount;
    return this.sanitizePost(post);
  }

  private async trackView(
    postId: string,
    ipAddress?: string,
    userId?: string,
    userAgent?: string
  ) {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

    const qb = this.viewRepository
      .createQueryBuilder("v")
      .where("v.postId = :postId", { postId })
      .andWhere("v.viewedAt > :since", { since: thirtyMinsAgo });

    if (userId) {
      qb.andWhere("v.userId = :userId", { userId });
    } else if (ipAddress) {
      qb.andWhere("v.ipAddress = :ip", { ip: ipAddress });
    } else {
      return;
    }
    const recent = await qb.getOne();
    if (recent) return;

    await this.viewRepository.save(
      this.viewRepository.create({ postId, ipAddress, userId, userAgent })
    );

    await this.postRepository.increment({ id: postId }, "viewCount", 1);
  }

  async getRelated(postId: string, limit = 5) {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ["tags", "category"],
    });
    if (!post) return [];

    const tagIds = post.tags.map((t) => t.id);

    const qb = this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.category", "category")
      .leftJoinAndSelect("post.tags", "tags")
      .where("post.id != :id", { id: postId })
      .andWhere("post.status = :status", { status: BlogPostStatus.PUBLISHED });

    if (tagIds.length > 0) {
      qb.andWhere("tags.id IN (:...tagIds)", { tagIds });
    } else {
      qb.andWhere("category.id = :catId", { catId: post.categoryId });
    }

    const related = await qb
      .orderBy("post.viewCount", "DESC")
      .take(limit)
      .getMany();

    return related.map((p) => this.sanitizePost(p));
  }

  async getLatest(limit = 5) {
    const posts = await this.postRepository.find({
      where: { status: BlogPostStatus.PUBLISHED },
      relations: ["category", "tags"],
      order: { publishedAt: "DESC" },
      take: limit,
    });
    return posts.map((p) => this.sanitizePost(p));
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
    const categoty = await this.categoryRepository.findOne({
      where: { id: data.categoryId },
    });
    if (!categoty) throw new NotFoundError("Category not found");

    const slug = await this.uniqueSlug(data.title);
    const tags = await this.findOrCreateTags(data.tags ?? []);

    const post = this.postRepository.create({
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
    return this.postRepository.save(post);
  }

  // Admin: update post
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
    const post = await this.postRepository.findOne({
      where: { id },
      relations: ["tags"],
    });
    if (!post) throw new NotFoundError("Post not found");

    if (data.title && data.title !== post.title) {
      post.slug = await this.uniqueSlug(data.title, id);
      post.title = data.title;
    }
    if (data.content !== undefined) post.content = data.content;
    if (data.excerpt !== undefined) post.excerpt = data.excerpt;
    if (data.thumbnail !== undefined) post.thumbnail = data.thumbnail;
    if (data.categoryId !== undefined) post.categoryId = data.categoryId;

    if (data.tags !== undefined) {
      post.tags = await this.findOrCreateTags(data.tags);
    }

    if (data.status && data.status !== post.status) {
      post.status = data.status;
      if (data.status === BlogPostStatus.PUBLISHED && !post.publishedAt) {
        post.publishedAt = new Date();
      }
    }

    return this.postRepository.save(post);
  }

  async deletePost(id: string) {
    const post = await this.postRepository.findOne({ where: { id } });
    if (!post) throw new NotFoundError("Post not found");
    await this.postRepository.softDelete(id);
  }

  // Admin: list all posts (include drafts)
  async adminListPosts(query: {
    page: number;
    limit: number;
    status?: BlogPostStatus;
    search?: string;
  }) {
    const { page, limit, status, search } = query;
    const qb = this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.category", "category")
      .leftJoinAndSelect("post.tags", "tags")
      .orderBy("post.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.andWhere("post.status = :status", { status });
    if (search) qb.andWhere("post.title ILIKE :s", { s: `%${search}%` });

    const [posts, total] = await qb.getManyAndCount();
    return { posts, total, page, limit, totalPages: Math.ceil(total / limit) };
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
}

export const blogService = new BlogService();
