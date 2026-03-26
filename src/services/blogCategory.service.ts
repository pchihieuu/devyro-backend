import { AppDataSource } from "../config/database.config";
import { BlogCategory } from "../entities/BlogCategory.entity";
import { ConflictError, NotFoundError } from "../utils/errors";
import slugify from "slugify";

export class BlogCategoryService {
  private repo = AppDataSource.getRepository(BlogCategory);

  async list() {
    return this.repo.find({ where: { isActive: true }, order: { name: "ASC" } });
  }

  async create(data: { name: string; description?: string; type: any }) {
    const slug = slugify(data.name, { lower: true, strict: true });
    const exists = await this.repo.findOne({ where: { slug } });
    if (exists) throw new ConflictError("Category already exists");

    const cat = this.repo.create({ ...data, slug });
    return this.repo.save(cat);
  }

  async update(id: string, data: Partial<{ name: string; description: string; isActive: boolean }>) {
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundError("Category not found");
    Object.assign(cat, data);
    if (data.name) cat.slug = slugify(data.name, { lower: true, strict: true });
    return this.repo.save(cat);
  }

  async delete(id: string) {
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundError("Category not found");
    await this.repo.remove(cat);
  }
}

export const blogCategoryService = new BlogCategoryService();