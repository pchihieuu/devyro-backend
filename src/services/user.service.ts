import { AppDataSource } from "../config/database.config";
import { User, UserRole } from "../entities/User.entity";
import {
  deleteFromCloudinary,
  extractPublicId,
} from "../utils/cloudinary.utils";
import { NotFoundError, ForbiddenError } from "../utils/errors";

interface UpdateProfileData {
  name?: string;
  avatar?: string;
  resume?: string;
}

export class UserService {
  private userRepository = AppDataSource.getRepository(User);

  /**
   * Update user profile (name, avatar, resume)
   */
  async updateProfile(userId: string, data: UpdateProfileData): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (data.name !== undefined && data.name.trim() !== "") {
      user.name = data.name;
    }

    if (data.avatar !== undefined) {
      if (data.avatar !== user.avatar) {
        await this.deleteOldFile(user.avatar, "image");
        user.avatar = data.avatar;
      }
    }

    if (data.resume !== undefined) {
      if (user.role !== UserRole.JOBSEEKER) {
        throw new ForbiddenError("Only jobseekers can update resume");
      }

      if (data.resume !== user.resume) {
        await this.deleteOldFile(user.resume, "raw");
        user.resume = data.resume;
      }
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
   * Get public user profile
   */
  async getPublicProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["company"],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        resume: true,
        createdAt: true,
        updatedAt: true,
      },
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
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
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