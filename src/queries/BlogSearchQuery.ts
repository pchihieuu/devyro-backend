// src/queries/BlogSearchQuery.ts
import { SelectQueryBuilder } from "typeorm";
import { BlogPost, BlogPostStatus } from "../entities/BlogPost.entity";

export interface BlogListFilter {
  page: number;
  limit: number;
  category?: string;
  tag?: string;
  search?: string;
  status?: BlogPostStatus; // admin only
  authorId?: string;
}

export class BlogSearchQuery {
  constructor(
    private qb: SelectQueryBuilder<BlogPost>,
    private filter: BlogListFilter
  ) {}

  /**
   * Apply all filters and pagination, return [posts, total]
   */
  async execute(): Promise<[BlogPost[], number]> {
    this.applyStatusFilter()
        .applyCategoryFilter()
        .applyTagFilter()
        .applySearchFilter()
        .applyAuthorFilter()
        .applySort()
        .applyPagination();

    return this.qb.getManyAndCount();
  }

  private applyStatusFilter(): this {
    if (this.filter.status) {
      // admin path: filter by specific status
      this.qb.andWhere("post.status = :status", { status: this.filter.status });
    }
    // public path: QB where PUBLISHED from basePublishedQB()
    return this;
  }

  private applyCategoryFilter(): this {
    if (this.filter.category) {
      this.qb.andWhere("category.slug = :category", { category: this.filter.category });
    }
    return this;
  }

  private applyTagFilter(): this {
    if (this.filter.tag) {
      this.qb.andWhere("tags.slug = :tag", { tag: this.filter.tag });
    }
    return this;
  }

  private applySearchFilter(): this {
    if (this.filter.search?.trim()) {
      this.qb.andWhere(
        "(post.title ILIKE :s OR post.excerpt ILIKE :s)",
        { s: `%${this.filter.search.trim()}%` }
      );
    }
    return this;
  }

  private applyAuthorFilter(): this {
    if (this.filter.authorId) {
      this.qb.andWhere("post.authorId = :authorId", { authorId: this.filter.authorId });
    }
    return this;
  }

  private applySort(): this {
    this.qb.orderBy("post.publishedAt", "DESC").addOrderBy("post.createdAt", "DESC");
    return this;
  }

  private applyPagination(): this {
    const { page, limit } = this.filter;
    this.qb.skip((page - 1) * limit).take(limit);
    return this;
  }
}