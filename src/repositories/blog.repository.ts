// src/repositories/blog.repository.ts
import { DataSource, Repository, SelectQueryBuilder } from "typeorm";
import { AppDataSource } from "../config/database.config";
import { BlogPost, BlogPostStatus } from "../entities/BlogPost.entity";
import { BlogTag } from "../entities/BlogTag.entity";

export class BlogRepository {
  private repo: Repository<BlogPost>;
  private tagRepo: Repository<BlogTag>;

  constructor(dataSource: DataSource = AppDataSource) {
    this.repo = dataSource.getRepository(BlogPost);
    this.tagRepo = dataSource.getRepository(BlogTag);
  }

  // base QB
  basePublishedQB(): SelectQueryBuilder<BlogPost> {
    return this.repo
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.category", "category")
      .leftJoinAndSelect("post.tags", "tags")
      .leftJoinAndSelect("post.author", "author")
      .where("post.status = :status", { status: BlogPostStatus.PUBLISHED });
  }

  // finders
  async findPublishedBySlug(slug: string): Promise<BlogPost | null> {
    return this.repo.findOne({
      where: { slug, status: BlogPostStatus.PUBLISHED },
      relations: ["category", "tags", "author"],
    });
  }

  async findById(id: string, withDeleted = false): Promise<BlogPost | null> {
    return this.repo.findOne({ where: { id }, withDeleted, relations: ["tags"] });
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const qb = this.repo
      .createQueryBuilder("post")
      .where("post.slug = :slug", { slug })
      .withDeleted();
    if (excludeId) qb.andWhere("post.id != :excludeId", { excludeId });
    return qb.getExists();
  }

  // tags (bulk, no N+1)
  async upsertTags(names: string[], makeSlug: (s: string) => string): Promise<BlogTag[]> {
    if (!names.length) return [];

    const slugs = names.map((n) => makeSlug(n));

    // 1 query: fetch all existing
    const existing = await this.tagRepo
      .createQueryBuilder("t")
      .where("t.slug IN (:...slugs)", { slugs })
      .getMany();

    const existingMap = new Map(existing.map((t) => [t.slug, t]));

    // 1 query: insert only truly new ones
    const newTags = names
      .map((name) => ({ name: name.trim(), slug: makeSlug(name) }))
      .filter(({ slug }) => !existingMap.has(slug));

    if (newTags.length) {
      await this.tagRepo
        .createQueryBuilder()
        .insert()
        .into(BlogTag)
        .values(newTags)
        .orIgnore() // safe for concurrent requests
        .execute();

      // fetch newly created (orIgnore means we can't rely on insertResult)
      const created = await this.tagRepo
        .createQueryBuilder("t")
        .where("t.slug IN (:...newSlugs)", { newSlugs: newTags.map((t) => t.slug) })
        .getMany();

      created.forEach((t) => existingMap.set(t.slug, t));
    }

    return slugs.map((s) => existingMap.get(s)!).filter(Boolean);
  }

  // mutations
  create(data: Partial<BlogPost>): BlogPost {
    return this.repo.create(data);
  }

  async save(post: BlogPost): Promise<BlogPost> {
    return this.repo.save(post);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.repo.increment({ id }, "viewCount", 1);
  }

  getRepo() {
    return this.repo;
  }
}

export const blogRepository = new BlogRepository();