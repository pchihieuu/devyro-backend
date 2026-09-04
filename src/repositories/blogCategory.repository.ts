import { AppDataSource } from "../config/database.config";
import { BlogCategory } from "../entities/BlogCategory.entity";

const categoryRepository = AppDataSource.getRepository(BlogCategory);

export class BlogCategoryRepository {
  async findActive(): Promise<BlogCategory[]> {
    return categoryRepository.find({
      where: { isActive: true },
      order: { name: "ASC" },
    });
  }

  async findAll(): Promise<BlogCategory[]> {
    return categoryRepository.find({ order: { name: "ASC" } });
  }

  async findById(id: string): Promise<BlogCategory | null> {
    return categoryRepository.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<BlogCategory | null> {
    return categoryRepository.findOne({ where: { slug } });
  }

  async create(data: Partial<BlogCategory>): Promise<BlogCategory> {
    return categoryRepository.save(categoryRepository.create(data));
  }

  async save(cat: BlogCategory): Promise<BlogCategory> {
    return categoryRepository.save(cat);
  }

  async remove(cat: BlogCategory): Promise<BlogCategory> {
    return categoryRepository.remove(cat);
  }
}

export const blogCategoryRepository = new BlogCategoryRepository();
