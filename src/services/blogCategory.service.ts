import slugify from "slugify";
import {
  BlogCategoryRepository,
  blogCategoryRepository,
} from "../repositories/blogCategory.repository";
import { BlogCategory } from "../entities/BlogCategory.entity";
import { ConflictError, NotFoundError } from "../utils/errors";
import {
  CreateCategoryBody,
  UpdateCategoryBody,
} from "../validators/blog.validator";
import {
  blogRepository,
  BlogRepository,
} from "../repositories/blog.repository";

export class BlogCategoryService {
  constructor(
    private readonly categoryRepo: BlogCategoryRepository = blogCategoryRepository,
    private readonly blogRepo: BlogRepository = blogRepository
  ) {}

  async list(): Promise<BlogCategory[]> {
    return this.categoryRepo.findActive();
  }

  async adminList(): Promise<BlogCategory[]> {
    return this.categoryRepo.findAll();
  }

  async create(data: CreateCategoryBody): Promise<BlogCategory> {
    const slug = slugify(data.name, { lower: true, strict: true });
    const exists = await this.categoryRepo.findBySlug(slug);
    if (exists) throw new ConflictError("Category already exists");

    return this.categoryRepo.create({ ...data, slug });
  }

  async update(id: string, data: UpdateCategoryBody): Promise<BlogCategory> {
    const cat = await this.categoryRepo.findById(id);
    if (!cat) throw new NotFoundError("Category not found");

    Object.assign(cat, data);
    if (data.name) cat.slug = slugify(data.name, { lower: true, strict: true });
    return this.categoryRepo.save(cat);
  }

  async delete(id: string): Promise<{ action: "deleted" | "deactivated" }> {
    const cat = await this.categoryRepo.findById(id);
    if (!cat) throw new NotFoundError("Category not found");

    const postCount = await this.blogRepo.countByCategory(id);
    if (postCount > 0) {
      if (cat.isActive) {
        cat.isActive = false;
        await this.categoryRepo.save(cat);
      }
      return { action: "deactivated" };
    }
    await this.categoryRepo.remove(cat);
    return { action: "deleted" };
  }
}
export const blogCategoryService = new BlogCategoryService();
