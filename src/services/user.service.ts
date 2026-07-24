import {
  deleteFromCloudinary,
  extractPublicId,
} from "../utils/cloudinary.utils";
import { User, UserRole } from "../entities/User.entity";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../utils/errors";
import {
  userRepository,
  UserRepository,
} from "../repositories/user.repository";
import {
  UpdateProfileData,
  ExperienceItem,
  ProjectItem,
  ProjectUpdateItem,
  ExperienceUpdateItem,
} from "../types/user.types";
import {
  buildPaginatedResult,
  getSkip,
  PaginatedResult,
} from "../utils/pagination.util";

export class UserService {
  constructor(private readonly userRepo: UserRepository = userRepository) {}

  async updateProfile(
    userId: string,
    data: UpdateProfileData
  ): Promise<Partial<User>> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    // Check quyền trước khi mutate bất cứ gì
    if (data.resume !== undefined && user.role !== UserRole.JOBSEEKER) {
      throw new ForbiddenError("Only jobseekers can update resume");
    }

    // Fix: validate hourlyRateMin/Max trên giá trị SAU KHI MERGE với DB.
    // Zod refine ở schema chỉ thấy payload của request này, không biết giá trị cũ trong DB,
    // nên partial update (chỉ gửi 1 trong 2 field) có thể tạo ra min > max mà không bị chặn.
    if (data.hourlyRateMin !== undefined || data.hourlyRateMax !== undefined) {
      const nextMin =
        data.hourlyRateMin !== undefined
          ? data.hourlyRateMin
          : user.hourlyRateMin;
      const nextMax =
        data.hourlyRateMax !== undefined
          ? data.hourlyRateMax
          : user.hourlyRateMax;
      if (nextMin != null && nextMax != null && nextMax < nextMin) {
        throw new BadRequestError(
          "Maximum rate must be greater than or equal to minimum rate"
        );
      }
    }

    // Lưu URL cũ để xoá SAU khi save DB thành công, tránh mất file mồ côi
    // nếu save() throw giữa chừng (mất kết nối DB, constraint lỗi...).
    const oldAvatar = user.avatar;
    const oldResume = user.resume;
    const avatarChanged =
      data.avatar !== undefined && data.avatar !== oldAvatar;
    const resumeChanged =
      data.resume !== undefined && data.resume !== oldResume;

    if (data.name !== undefined && data.name.trim() !== "")
      user.name = data.name;
    if (avatarChanged) user.avatar = data.avatar!;
    if (resumeChanged) user.resume = data.resume!;

    // "" nghĩa là chủ đích xoá field, khác với `name` (bỏ qua nếu rỗng)
    if (data.title !== undefined) user.title = data.title || null;
    if (data.bio !== undefined) user.bio = data.bio || null;
    if (data.location !== undefined) user.location = data.location || null;

    if (data.hourlyRateMin !== undefined)
      user.hourlyRateMin = data.hourlyRateMin;
    if (data.hourlyRateMax !== undefined)
      user.hourlyRateMax = data.hourlyRateMax;
    if (data.responseTimeHours !== undefined)
      user.responseTimeHours = data.responseTimeHours;
    if (data.availabilityStatus !== undefined)
      user.availabilityStatus = data.availabilityStatus;
    if (data.skills !== undefined) user.skills = data.skills;

    const saved = await this.userRepo.save(user);

    // Chỉ xoá file cũ SAU KHI save DB chắc chắn thành công
    if (avatarChanged) await this.deleteOldFile(oldAvatar, "image");
    if (resumeChanged) await this.deleteOldFile(oldResume, "raw");

    return this.toMyProfileDto(saved);
  }

  async deleteResume(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    if (user.role !== UserRole.JOBSEEKER) {
      throw new ForbiddenError("Only jobseekers can delete resume");
    }
    if (!user.resume) throw new NotFoundError("No resume found to delete");

    const oldResume = user.resume;
    user.resume = null;
    await this.userRepo.save(user);

    // Xoá file sau khi save DB thành công, cùng nguyên tắc với updateProfile
    await this.deleteOldFile(oldResume, "raw");
  }

  async getPublicProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userRepo.findByIdWithCompany(userId);
    if (!user) throw new NotFoundError("User not found");

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      avatar: user.avatar || "",
      resume: user.role === UserRole.JOBSEEKER ? user.resume || "" : undefined,
      username: user.username,
      title: user.title,
      bio: user.bio,
      location: user.location,
      workPreference: user.workPreference,
      hourlyRateMin: user.hourlyRateMin,
      hourlyRateMax: user.hourlyRateMax,
      completionRate: user.completionRate,
      totalProjects: user.totalProjects,
      responseTimeHours: user.responseTimeHours,
      availabilityStatus: user.availabilityStatus,
      skills: user.skills || [],
      experience: user.experience || [],
      projects: user.projects || [],
      rating: user.rating,
      reviewCount: user.reviewCount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async getMyProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userRepo.findByIdSelectProfile(userId);
    if (!user) throw new NotFoundError("User not found");
    return user;
  }

  private toMyProfileDto(user: User): Partial<User> {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      resume: user.resume,
      username: user.username,
      title: user.title,
      bio: user.bio,
      location: user.location,
      workPreference: user.workPreference,
      hourlyRateMin: user.hourlyRateMin,
      hourlyRateMax: user.hourlyRateMax,
      completionRate: user.completionRate,
      totalProjects: user.totalProjects,
      responseTimeHours: user.responseTimeHours,
      availabilityStatus: user.availabilityStatus,
      skills: user.skills,
      experience: user.experience,
      projects: user.projects,
      rating: user.rating,
      reviewCount: user.reviewCount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async searchUsers(
    query: string,
    currentUserId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResult<Partial<User>>> {
    const skip = getSkip(page, limit);
    const [users, total] = await this.userRepo.searchUsers(
      query,
      currentUserId,
      skip,
      limit
    );
    return buildPaginatedResult(users, total, page, limit);
  }

  async addExperience(
    userId: string,
    experience: ExperienceItem
  ): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    const experiences = user.experience || [];
    experiences.push({ id: crypto.randomUUID(), ...experience });
    user.experience = experiences;

    return this.userRepo.save(user);
  }

  async updateExperience(
    userId: string,
    experienceId: string,
    experience: ExperienceUpdateItem
  ): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    const idx = (user.experience || []).findIndex((e) => e.id === experienceId);
    if (idx === -1) throw new NotFoundError("Experience not found");

    // Merge với item cũ, chỉ field nào client gửi lên mới bị ghi đè
    const merged = { ...user.experience[idx], ...experience, id: experienceId };

    // Validate thứ tự ngày trên state SAU KHI MERGE, không phải trên payload gửi lên,
    // vì payload có thể chỉ chứa 1 trong 2 field ngày.
    if (merged.startDate && merged.endDate) {
      const start = new Date(merged.startDate);
      const end = new Date(merged.endDate);
      if (end < start) {
        throw new BadRequestError("End date must be after start date");
      }
    }

    user.experience[idx] = merged;
    return this.userRepo.save(user);
  }

  async deleteExperience(userId: string, experienceId: string): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    const idx = (user.experience || []).findIndex((e) => e.id === experienceId);
    if (idx === -1) throw new NotFoundError("Experience not found");

    user.experience.splice(idx, 1);
    return this.userRepo.save(user);
  }

  async addProject(userId: string, project: ProjectItem): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    const projects = user.projects || [];
    projects.push({ id: crypto.randomUUID(), ...project });
    user.projects = projects;

    return this.userRepo.save(user);
  }

  async updateProject(
    userId: string,
    projectId: string,
    project: ProjectUpdateItem
  ): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    const index = (user.projects || []).findIndex((p) => p.id === projectId);
    if (index === -1) throw new NotFoundError("Project not found");

    const oldItem = user.projects[index];
    const oldImage = oldItem.image;
    const merged = { ...oldItem, ...project, id: projectId };
    const imageChanged = !!oldImage && merged.image !== oldImage;

    user.projects[index] = merged;
    const saved = await this.userRepo.save(user);

    if (imageChanged) await this.deleteOldFile(oldImage, "image");

    return saved;
  }

  async deleteProject(userId: string, projectId: string): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    const index = (user.projects || []).findIndex((p) => p.id === projectId);
    if (index === -1) throw new NotFoundError("Project not found");

    const oldImage = user.projects[index].image;
    user.projects.splice(index, 1);
    const saved = await this.userRepo.save(user);

    if (oldImage) await this.deleteOldFile(oldImage, "image");

    return saved;
  }

  private async deleteOldFile(
    fileUrl: string | null | undefined,
    resourceType: "image" | "raw"
  ): Promise<void> {
    if (fileUrl) {
      const publicId = extractPublicId(fileUrl);
      if (publicId) {
        try {
          await deleteFromCloudinary(publicId, resourceType);
        } catch (error) {
          console.error(`Error deleting old ${resourceType}:`, error);
        }
      }
    }
  }

  async updateAvatar(userId: string, newAvatarUrl: string): Promise<void> {
    const user = await this.userRepo.findByIdSelect(userId, ["id", "avatar"]);
    if (!user) throw new NotFoundError("User not found");

    const oldAvatar = user.avatar;
    await this.userRepo.updateFields(userId, { avatar: newAvatarUrl });

    if (oldAvatar && oldAvatar !== newAvatarUrl) {
      await this.deleteOldFile(oldAvatar, "image");
    }
  }

  async updateResume(userId: string, newResumeUrl: string): Promise<void> {
    const user = await this.userRepo.findByIdSelect(userId, [
      "id",
      "resume",
      "role",
    ]);
    if (!user) throw new NotFoundError("User not found");

    if (user.role !== UserRole.JOBSEEKER) {
      throw new ForbiddenError("Only jobseekers can update resume");
    }

    const oldResume = user.resume;
    await this.userRepo.updateFields(userId, { resume: newResumeUrl });

    if (oldResume && oldResume !== newResumeUrl) {
      await this.deleteOldFile(oldResume, "raw");
    }
  }
}

export const userService = new UserService();
