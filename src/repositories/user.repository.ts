import { Repository } from "typeorm";
import { AppDataSource } from "../config/database.config";
import { User } from "../entities/User.entity";

const MY_PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
  resume: true,
  username: true,
  title: true,
  bio: true,
  location: true,
  workPreference: true,
  hourlyRateMin: true,
  hourlyRateMax: true,
  completionRate: true,
  totalProjects: true,
  responseTimeHours: true,
  availabilityStatus: true,
  skills: true,
  experience: true,
  projects: true,
  rating: true,
  reviewCount: true,
  createdAt: true,
  updatedAt: true,
} as const;

type UpdatableUserFields = Omit<
  User,
  "jobs" | "applications" | "savedJobs" | "company" | "notifications"
>;
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

  /**
   * Search theo tên/email/username, tuỳ chọn thêm filter skills.
   * FIX: gộp filter skill vào CÙNG 1 pipeline QueryBuilder với search text, thay vì
   * viết method song song riêng — tránh bug "2 method xử lý cùng bộ filter bằng
   * 2 kỹ thuật khác nhau" (rule Repository layer #4).
   * Dùng toán tử && (overlap) trên cột text[] + tận dụng GIN index IDX_users_skills_gin,
   * thay cho ILIKE trên chuỗi comma-separated trước đây (vừa chậm vừa match sai khi
   * skill là substring của nhau, vd "react" match nhầm "react-native").
   */
  async searchUsers(
    query: string,
    excludeUserId: string,
    skip: number,
    take: number,
    skills?: string[]
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
        "user.skills",
      ])
      .where("user.id != :excludeUserId", { excludeUserId })
      .andWhere(
        "(user.name ILIKE :q OR user.email ILIKE :q OR user.username ILIKE :q)",
        { q: `%${query}%` }
      );

    if (skills && skills.length > 0) {
      // skills đến từ validator đã lowercase sẵn -> so khớp trực tiếp bằng &&
      qb.andWhere("user.skills && :skills", { skills });
    }

    qb.orderBy("user.name", "ASC").skip(skip).take(take);

    return qb.getManyAndCount();
  }

  /**
   * Match user theo skill overlap thuần tuý (không kèm text search) — dùng cho tính
   * năng gợi ý ứng viên theo skill của job sau này. Tách riêng khỏi searchUsers vì
   * ngữ nghĩa khác (không có "query" text), không phải filter phụ.
   */
  async findBySkillsOverlap(
    skills: string[],
    excludeUserId: string,
    skip: number,
    take: number
  ): Promise<[User[], number]> {
    return this.repo
      .createQueryBuilder("user")
      .select([
        "user.id",
        "user.name",
        "user.avatar",
        "user.username",
        "user.title",
        "user.availabilityStatus",
        "user.skills",
      ])
      .where("user.id != :excludeUserId", { excludeUserId })
      .andWhere("user.skills && :skills", { skills })
      .orderBy("user.name", "ASC")
      .skip(skip)
      .take(take)
      .getManyAndCount();
  }

  async findById(userId: string): Promise<User | null> {
    return this.repo.findOne({ where: { id: userId } });
  }

  async findByIdWithCompany(userId: string): Promise<User | null> {
    return this.repo.findOne({ where: { id: userId }, relations: ["company"] });
  }

  async findByIdSelectProfile(userId: string): Promise<User | null> {
    return this.repo.findOne({
      where: { id: userId },
      relations: ["company"],
      select: MY_PROFILE_SELECT,
    });
  }

  async findByIdSelect(
    userId: string,
    select: (keyof User)[]
  ): Promise<User | null> {
    return this.repo.findOne({ where: { id: userId }, select });
  }

  async save(user: User): Promise<User> {
    return this.repo.save(user);
  }

  async updateFields(
    userId: string,
    fields: Partial<UpdatableUserFields>
  ): Promise<void> {
    await this.repo.update(userId, fields);
  }
}

export const userRepository = new UserRepository();
