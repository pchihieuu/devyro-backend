import { Repository } from "typeorm";
import { AppDataSource } from "../config/database.config";
import { User } from "../entities/User.entity";

export class UserRepository {
  private repo: Repository<User> = AppDataSource.getRepository(User);

  async findByUsernameExcludingUser(
    username: string,
    excludeUserId: string
  ): Promise<User | null> {
    return this.repo
      .createQueryBuilder("user")
      .where("user.username = :username", { username })
      .andWhere("user.id != :excludeUserId", { excludeUserId })
      .getOne();
  }

  async searchUsers(
    query: string,
    excludeUserId: string,
    skip: number,
    take: number
  ): Promise<[User[], number]> {
    const qb = this.repo
      .createQueryBuilder("user")
      .select([
        "user.id",
        "user.name",
        "user.email",
        "user.avatar",
        "user.role",
        "user.username",
        "user.title",
        "user.availabilityStatus",
      ])
      .where("user.id != :excludeUserId", { excludeUserId })
      .andWhere(
        "(user.name ILIKE :q OR user.email ILIKE :q OR user.username ILIKE :q)",
        { q: `%${query}%` }
      )
      .orderBy("user.name", "ASC")
      .skip(skip)
      .take(take);

    return qb.getManyAndCount();
  }

  async findById(userId: string): Promise<User | null> {
    return this.repo.findOne({ where: { id: userId } });
  }

  async findByIdWithCompany(userId: string): Promise<User | null> {
    return this.repo.findOne({ where: { id: userId }, relations: ["company"] });
  }

  /**
   * Select tối ưu cho getMyProfile — tránh load cột thừa từ DB
   */
  async findByIdSelectProfile(userId: string): Promise<User | null> {
    return this.repo.findOne({
      where: { id: userId },
      relations: ["company"],
      select: {
        id: true, name: true, email: true, role: true, avatar: true,
        resume: true, username: true, title: true, bio: true, location: true,
        workPreference: true, hourlyRateMin: true, hourlyRateMax: true,
        completionRate: true, totalProjects: true, responseTimeHours: true,
        availabilityStatus: true, skills: true, experience: true, projects: true,
        rating: true, reviewCount: true, createdAt: true, updatedAt: true,
      },
    });
  }

  async findByIdSelect(userId: string, select: (keyof User)[]): Promise<User | null> {
    return this.repo.findOne({ where: { id: userId }, select });
  }

  async save(user: User): Promise<User> {
    return this.repo.save(user);
  }

  async updateFields(userId: string, fields: Partial<User>): Promise<void> {
    await this.repo.update(userId, fields);
  }
}

export const userRepository = new UserRepository();