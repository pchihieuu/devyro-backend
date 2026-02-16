import { AppDataSource } from "../config/database.config";
import { User, UserRole, WorkPreference, AvailabilityStatus } from "../entities/User.entity";
import {
  deleteFromCloudinary,
  extractPublicId,
} from "../utils/cloudinary.utils";
import { NotFoundError, ForbiddenError, BadRequestError } from "../utils/errors";
import { ILike, Not } from "typeorm";

interface UpdateProfileData {
  name?: string;
  avatar?: string;
  resume?: string;
  username?: string;
  title?: string;
  bio?: string;
  location?: string;
  workPreference?: WorkPreference;
  hourlyRateMin?: number;
  hourlyRateMax?: number;
  responseTimeHours?: number;
  availabilityStatus?: AvailabilityStatus;
  skills?: string[];
  experience?: {
    title: string;
    company: string;
    companyLink?: string;
    description: string;
    startDate: string;
    endDate?: string;
  }[];
  projects?: {
    title: string;
    description: string;
    technologies: string[];
    link?: string;
    image?: string;
  }[];
}

export class UserService {
  private userRepository = AppDataSource.getRepository(User);

  /**
   * Update user profile (comprehensive)
   */
  async updateProfile(userId: string, data: UpdateProfileData): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Basic fields
    if (data.name !== undefined && data.name.trim() !== "") {
      user.name = data.name;
    }

    // Username validation
    if (data.username !== undefined) {
      if (data.username.trim() !== "") {
        // Check if username is already taken by another user
        const existingUser = await this.userRepository.findOne({
          where: { 
            username: data.username,
            id: Not(userId)
          },
        });

        if (existingUser) {
          throw new BadRequestError("Username already taken");
        }

        user.username = data.username;
      } else {
        user.username = null;
      }
    }

    // Avatar handling
    if (data.avatar !== undefined) {
      if (data.avatar !== user.avatar) {
        await this.deleteOldFile(user.avatar, "image");
        user.avatar = data.avatar;
      }
    }

    // Resume handling (jobseekers only)
    if (data.resume !== undefined) {
      if (user.role !== UserRole.JOBSEEKER) {
        throw new ForbiddenError("Only jobseekers can update resume");
      }

      if (data.resume !== user.resume) {
        await this.deleteOldFile(user.resume, "raw");
        user.resume = data.resume;
      }
    }

    // Professional fields
    if (data.title !== undefined) {
      user.title = data.title || null;
    }

    if (data.bio !== undefined) {
      user.bio = data.bio || null;
    }

    if (data.location !== undefined) {
      user.location = data.location || null;
    }

    if (data.workPreference !== undefined) {
      user.workPreference = data.workPreference || null;
    }

    // Rate fields
    if (data.hourlyRateMin !== undefined) {
      user.hourlyRateMin = data.hourlyRateMin;
    }

    if (data.hourlyRateMax !== undefined) {
      user.hourlyRateMax = data.hourlyRateMax;
    }

    if (data.responseTimeHours !== undefined) {
      user.responseTimeHours = data.responseTimeHours;
    }

    if (data.availabilityStatus !== undefined) {
      user.availabilityStatus = data.availabilityStatus;
    }

    // Skills
    if (data.skills !== undefined) {
      user.skills = data.skills;
    }

    // Experience
    if (data.experience !== undefined) {
      user.experience = data.experience;
    }

    // Projects
    if (data.projects !== undefined) {
      user.projects = data.projects;
    }

    await this.userRepository.save(user);

    return user;
  }

  /**
   * Delete jobseeker's resume
   */
  async deleteResume(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (user.role !== UserRole.JOBSEEKER) {
      throw new ForbiddenError("Only jobseekers can delete resume");
    }

    if (!user.resume) {
      throw new NotFoundError("No resume found to delete");
    }

    await this.deleteOldFile(user.resume, "raw");

    user.resume = null;
    await this.userRepository.save(user);
  }

  /**
   * Get public user profile (full profile with all details)
   */
  async getPublicProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["company"],
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar || "",
      resume: user.resume || "",
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

  /**
   * Get own profile (authenticated user)
   */
  async getMyProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["company"],
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return user;
  }

  /**
   * Search users by name or email (for chat)
   */
  async searchUsers(
    query: string,
    currentUserId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ users: Partial<User>[]; total: number }> {
    const skip = (page - 1) * limit;

    const [users, total] = await this.userRepository.findAndCount({
      where: [
        { name: ILike(`%${query}%`) },
        { email: ILike(`%${query}%`) },
        { username: ILike(`%${query}%`) },
      ],
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        username: true,
        title: true,
        availabilityStatus: true,
      },
      take: limit,
      skip,
    });

    // Filter out current user
    const filteredUsers = users.filter((user) => user.id !== currentUserId);

    return {
      users: filteredUsers,
      total: filteredUsers.length,
    };
  }

  /**
   * Add experience to profile
   */
  async addExperience(
    userId: string,
    experience: {
      title: string;
      company: string;
      companyLink?: string;
      description: string;
      startDate: string;
      endDate?: string;
    }
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const experiences = user.experience || [];
    experiences.push(experience);
    user.experience = experiences;

    await this.userRepository.save(user);

    return user;
  }

  /**
   * Update experience
   */
  async updateExperience(
    userId: string,
    index: number,
    experience: {
      title: string;
      company: string;
      companyLink?: string;
      description: string;
      startDate: string;
      endDate?: string;
    }
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (!user.experience || index >= user.experience.length || index < 0) {
      throw new BadRequestError("Invalid experience index");
    }

    user.experience[index] = experience;

    await this.userRepository.save(user);

    return user;
  }

  /**
   * Delete experience
   */
  async deleteExperience(userId: string, index: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (!user.experience || index >= user.experience.length || index < 0) {
      throw new BadRequestError("Invalid experience index");
    }

    user.experience.splice(index, 1);

    await this.userRepository.save(user);

    return user;
  }

  /**
   * Add project to profile
   */
  async addProject(
    userId: string,
    project: {
      title: string;
      description: string;
      technologies: string[];
      link?: string;
      image?: string;
    }
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const projects = user.projects || [];
    projects.push(project);
    user.projects = projects;

    await this.userRepository.save(user);

    return user;
  }

  /**
   * Update project
   */
  async updateProject(
    userId: string,
    index: number,
    project: {
      title: string;
      description: string;
      technologies: string[];
      link?: string;
      image?: string;
    }
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (!user.projects || index >= user.projects.length || index < 0) {
      throw new BadRequestError("Invalid project index");
    }

    // Delete old project image if it exists and is being replaced
    if (
      user.projects[index].image &&
      project.image !== user.projects[index].image
    ) {
      await this.deleteOldFile(user.projects[index].image, "image");
    }

    user.projects[index] = project;

    await this.userRepository.save(user);

    return user;
  }

  /**
   * Delete project
   */
  async deleteProject(userId: string, index: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (!user.projects || index >= user.projects.length || index < 0) {
      throw new BadRequestError("Invalid project index");
    }

    // Delete project image if it exists
    if (user.projects[index].image) {
      await this.deleteOldFile(user.projects[index].image, "image");
    }

    user.projects.splice(index, 1);

    await this.userRepository.save(user);

    return user;
  }

  /**
   * Delete old file from Cloudinary
   */
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