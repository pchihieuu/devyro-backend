import {
  deleteFromCloudinary,
  extractPublicId,
} from "../utils/cloudinary.utils";
import crypto from "crypto";
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
  PublicProfileDto,
  MyProfileDto,
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
  ): Promise<MyProfileDto> {
    const user = await this.getUserOrThrow(userId);

    if (data.resume !== undefined && user.role !== UserRole.JOBSEEKER) {
      throw new ForbiddenError("Only jobseekers can update resume");
    }

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

    const oldAvatar = user.avatar;
    const oldResume = user.resume;
    const avatarChanged =
      data.avatar !== undefined && data.avatar !== oldAvatar;
    const resumeChanged =
      data.resume !== undefined && data.resume !== oldResume;

    if (data.name !== undefined && data.name.trim() !== "")
      user.name = data.name;

    if (avatarChanged) user.avatar = data.avatar || null;
    if (resumeChanged) user.resume = data.resume || null;

    if (data.title !== undefined) user.title = data.title || null;
    if (data.bio !== undefined) user.bio = data.bio || null;
    if (data.location !== undefined) user.location = data.location || null;

    if (data.hourlyRateMin !== undefined)
      user.hourlyRateMin = data.hourlyRateMin;
    if (data.hourlyRateMax !== undefined)
      user.hourlyRateMax = data.hourlyRateMax;
    if (data.responseTimeHours !== undefined)
      user.responseTimeHours = data.responseTimeHours;
    if (data.workPreference !== undefined)
      user.workPreference = data.workPreference;
    if (data.availabilityStatus !== undefined)
      user.availabilityStatus = data.availabilityStatus;

    // data.skills ở đây đã được validator lowercase + dedupe, service chỉ gán thẳng
    // (không xử lý lại chuẩn hoá — tránh 2 nơi transform như bug từng gặp).
    if (data.skills !== undefined) user.skills = data.skills;

    const saved = await this.userRepo.save(user);

    if (avatarChanged) await this.deleteOldFile(oldAvatar, "image");
    if (resumeChanged) await this.deleteOldFile(oldResume, "raw");

    return this.toMyProfileDto(saved);
  }

  async deleteResume(userId: string): Promise<void> {
    const user = await this.getUserOrThrow(userId);
    if (user.role !== UserRole.JOBSEEKER) {
      throw new ForbiddenError("Only jobseekers can delete resume");
    }
    if (!user.resume) throw new NotFoundError("No resume found to delete");

    const oldResume = user.resume;
    user.resume = null;
    await this.userRepo.save(user);

    await this.deleteOldFile(oldResume, "raw");
  }

  async getPublicProfile(
    userId: string,
    viewer?: { id: string; role: UserRole }
  ): Promise<PublicProfileDto> {
    const user = await this.userRepo.findByIdWithCompany(userId);
    if (!user) throw new NotFoundError("User not found");

    const canViewResume =
      user.role === UserRole.JOBSEEKER &&
      !!viewer &&
      (viewer.role === UserRole.EMPLOYER ||
        viewer.role === UserRole.ADMIN ||
        viewer.id === user.id);
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      avatar: user.avatar || "",
      resume: canViewResume ? user.resume || "" : undefined,
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

  async getMyProfile(userId: string): Promise<MyProfileDto> {
    const user = await this.userRepo.findByIdSelectProfile(userId);
    if (!user) throw new NotFoundError("User not found");
    return user;
  }

  private toMyProfileDto(user: User): MyProfileDto {
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

  /**
   * FIX: nhận thêm `skills` (đã lowercase từ validator) để filter bằng overlap ở
   * repository, thay vì chỉ search theo tên/email/username như trước.
   */
  async searchUsers(
    query: string,
    currentUserId: string,
    page: number = 1,
    limit: number = 20,
    skills?: string[]
  ): Promise<PaginatedResult<Partial<User>>> {
    const skip = getSkip(page, limit);
    const [users, total] = await this.userRepo.searchUsers(
      query,
      currentUserId,
      skip,
      limit,
      skills
    );
    return buildPaginatedResult(users, total, page, limit);
  }

  async addExperience(
    userId: string,
    experience: ExperienceItem
  ): Promise<User> {
    const user = await this.getUserOrThrow(userId);

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
    const user = await this.getUserOrThrow(userId);

    const idx = (user.experience || []).findIndex((e) => e.id === experienceId);
    if (idx === -1) throw new NotFoundError("Experience not found");

    const merged = { ...user.experience[idx], ...experience, id: experienceId };

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
    const user = await this.getUserOrThrow(userId);
    const idx = (user.experience || []).findIndex((e) => e.id === experienceId);
    if (idx === -1) throw new NotFoundError("Experience not found");

    user.experience.splice(idx, 1);
    return this.userRepo.save(user);
  }

  async addProject(userId: string, project: ProjectItem): Promise<User> {
    const user = await this.getUserOrThrow(userId);

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
    const user = await this.getUserOrThrow(userId);

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
    const user = await this.getUserOrThrow(userId);
    const index = (user.projects || []).findIndex((p) => p.id === projectId);
    if (index === -1) throw new NotFoundError("Project not found");

    const oldImage = user.projects[index].image;
    user.projects.splice(index, 1);
    const saved = await this.userRepo.save(user);

    if (oldImage) await this.deleteOldFile(oldImage, "image");

    return saved;
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

  private async getUserOrThrow(userId: string): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    return user;
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
}

export const userService = new UserService();
