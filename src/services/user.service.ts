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

    if (data.name) {
      user.name = data.name;
    }
    if (data.avatar && data.avatar !== user.avatar) {
      await this.deleteOldFile(user.avatar, "image");
      user.avatar = data.avatar;
    }

    if (
      user.role === UserRole.JOBSEEKER &&
      data.resume &&
      data.resume !== user.resume
    ) {
      await this.deleteOldFile(user.resume, "raw");
      user.resume = data.resume;
    }

    await this.userRepository.save(user);

    return user;
  }

  /**
   * Delete jobseeker's resume
   */
  async deleteResume(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) throw new NotFoundError("User not found");
    if (user.role !== UserRole.JOBSEEKER) {
      throw new ForbiddenError("Only jobseekers can delete resume");
    }

    await this.deleteOldFile(user.resume, "raw");

    user.resume = "";
    await this.userRepository.save(user);
  }

  /**
   * Get public user profile
   */
  async getPublicProfile(userId: string): Promise<User> {
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

    return user;
  }

  /**
   * Delete old file from Cloudinary
   */
  private async deleteOldFile(
    fileUrl: string | undefined,
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