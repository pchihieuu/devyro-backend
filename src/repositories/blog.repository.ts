import { AppDataSource } from "../config/database.config";
import { BlogPost, BlogPostStatus } from "../entities/BlogPost.entity";
import { BlogPostView } from "../entities/BlogPostView.entity";
import { BlogTag } from "../entities/BlogTag.entity";
import { getSkip } from "../utils/pagination.util";

const postRepository = AppDataSource.getRepository(BlogPost);
const tagRepository = AppDataSource.getRepository(BlogTag);
const viewRepository = AppDataSource.getRepository(BlogPostView);

const PUBLIC_POST_RELATIONS = ["category", "tags", "author"] as const;

type ListFilters = {
  page: number;
  limit: number;
  sortBy: string;
  order: "ASC" | "DESC";
  category?: string;
  tag?: string;
  search?: string;
};

type AdminListFilters = ListFilters & { status?: BlogPostStatus };

function applyCommonFilters(
  qb: ReturnType<typeof postRepository.createQueryBuilder>,
  filters: Pick<ListFilters, "category" | "tag" | "search">
) {
  if (filters.category)
    qb.andWhere("category.slug = :category", { category: filters.category });
  if (filters.tag) qb.andWhere("tags.slug = :tag", { tag: filters.tag });
  if (filters.search) {
    qb.andWhere("(post.title ILIKE :s OR post.excerpt ILIKE :s)", {
      s: `%${filters.search}%`,
    });
  }
}

export class BlogRepository {
  async findPublished(filters: ListFilters): Promise<[BlogPost[], number]> {
    const qb = postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.category", "category")
      .leftJoinAndSelect("post.tags", "tags")
      .leftJoinAndSelect("post.author", "author")
      .where("post.status = :status", { status: BlogPostStatus.PUBLISHED })
      .orderBy(`post.${filters.sortBy}`, filters.order)
      .skip(getSkip(filters.page, filters.limit))
      .take(filters.limit);

    applyCommonFilters(qb, filters);
    return qb.getManyAndCount();
  }

  /** Danh sách bài viết cho trang quản trị (mọi status, filter thêm theo status). */
  async findForAdmin(filters: AdminListFilters): Promise<[BlogPost[], number]> {
    const qb = postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.category", "category")
      .leftJoinAndSelect("post.tags", "tags")
      .orderBy(`post.${filters.sortBy}`, filters.order)
      .skip(getSkip(filters.page, filters.limit))
      .take(filters.limit);
    if (filters.status)
      qb.andWhere("post.status = :status", { status: filters.status });
    applyCommonFilters(qb, filters);
    return qb.getManyAndCount();
  }

  /** Dùng cho trang edit admin — lấy mọi status. */
  async findByIdWithRelations(id: string): Promise<BlogPost | null> {
    return postRepository.findOne({
      where: { id },
      relations: [...PUBLIC_POST_RELATIONS],
    });
  }

  /** Dùng cho trang chi tiết public — chỉ lấy bài đã publish. */
  async findPublishedBySlug(slug: string): Promise<BlogPost | null> {
    return postRepository.findOne({
      where: { slug, status: BlogPostStatus.PUBLISHED },
      relations: [...PUBLIC_POST_RELATIONS],
    });
  }

  /** Chỉ lấy tags + category, dùng riêng để tính bài viết liên quan. */
  async findByIdWithTags(id: string): Promise<BlogPost | null> {
    return postRepository.findOne({
      where: { id },
      relations: ["tags", "category"],
    });
  }

  async findRelated(
    postId: string,
    tagIds: string[],
    categoryId: string,
    limit: number
  ): Promise<BlogPost[]> {
    const qb = postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.category", "category")
      .leftJoinAndSelect("post.tags", "tags")
      .where("post.id != :id", { id: postId })
      .andWhere("post.status = :status", { status: BlogPostStatus.PUBLISHED });

    if (tagIds.length > 0) {
      qb.andWhere("tags.id IN (:...tagIds)", { tagIds });
    } else {
      qb.andWhere("category.id = :catId", { catId: categoryId });
    }
    return qb.orderBy("post.viewCount", "DESC").take(limit).getMany();
  }

  async findLatestPublished(limit: number): Promise<BlogPost[]> {
    return postRepository.find({
      where: { status: BlogPostStatus.PUBLISHED },
      relations: ["category", "tags"],
      order: { publishedAt: "DESC" },
      take: limit,
    });
  }

  /** Check trùng slug, tính cả bài đã soft-delete để tránh đụng slug cũ. */
  async findBySlugIncludeDeleted(slug: string): Promise<BlogPost | null> {
    return postRepository.findOne({ where: { slug }, withDeleted: true });
  }

  /** Đếm số bài viết thuộc 1 category — dùng để chặn xoá category còn post tham chiếu. */
  async countByCategory(categoryId: string): Promise<number> {
    return postRepository.count({ where: { categoryId }, withDeleted: true });
  }

  async create(data: Partial<BlogPost>): Promise<BlogPost> {
    return postRepository.save(postRepository.create(data));
  }

  async save(post: BlogPost): Promise<BlogPost> {
    return postRepository.save(post);
  }

  async softDelete(id: string): Promise<void> {
    await postRepository.softDelete(id);
  }

  async incrementViewCount(id: string): Promise<void> {
    await postRepository.increment({ id }, "viewCount", 1);
  }

  async findTagBySlug(slug: string): Promise<BlogTag | null> {
    return tagRepository.findOne({ where: { slug } });
  }

  async createTag(name: string, slug: string): Promise<BlogTag> {
    return tagRepository.save(tagRepository.create({ name, slug }));
  }

  // --- View tracking ---
  async findRecentView(
    postId: string,
    since: Date,
    userId?: string,
    ipAddress?: string
  ): Promise<BlogPostView | null> {
    const qb = viewRepository
      .createQueryBuilder("v")
      .where("v.postId = :postId", { postId })
      .andWhere("v.viewedAt > :since", { since });

    if (userId) {
      qb.andWhere("v.userId = :userId", { userId });
    } else if (ipAddress) {
      qb.andWhere("v.ipAddress = :ip", { ip: ipAddress });
    } else {
      return null;
    }
    return qb.getOne();
  }

  async createView(data: {
    postId: string;
    ipAddress?: string;
    userId?: string;
    userAgent?: string;
  }): Promise<BlogPostView> {
    return viewRepository.save(viewRepository.create(data));
  }
}

export const blogRepository = new BlogRepository();
