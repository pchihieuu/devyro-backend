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
  companyName?: string;
  companyDescription?: string;
  companyLogo?: string;
  companySize?: string;
  companyIndustry?: string;
  companyAddress?: string;
  companyWebsite?: string;
}

export class UserService {
  private userRepository = AppDataSource.getRepository(User);

  async updateProfile(userId: string, data: UpdateProfileData): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Update name
    if (data.name) {
      user.name = data.name;
    }

    // Handle avatar update
    if (data.avatar && data.avatar !== user.avatar) {
      await this.deleteOldFile(user.avatar, "image");
      user.avatar = data.avatar;
    }

    // Handle resume update for jobseekers
    if (
      user.role === UserRole.JOBSEEKER &&
      data.resume &&
      data.resume !== user.resume
    ) {
      await this.deleteOldFile(user.resume, "raw");
      user.resume = data.resume;
    }

    // Handle employer fields
    if (user.role === UserRole.EMPLOYER) {
      if (data.companyName) user.companyName = data.companyName;
      if (data.companyDescription)
        user.companyDescription = data.companyDescription;
      if (data.companySize) user.companySize = data.companySize;
      if (data.companyIndustry) user.companyIndustry = data.companyIndustry;
      if (data.companyAddress) user.companyAddress = data.companyAddress;
      if (data.companyWebsite) user.companyWebsite = data.companyWebsite;

      // Handle company logo update
      if (data.companyLogo && data.companyLogo !== user.companyLogo) {
        await this.deleteOldFile(user.companyLogo, "image");
        user.companyLogo = data.companyLogo;
      }
    }

    await this.userRepository.save(user);

    return user;
  }

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

  async getPublicProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        "id",
        "name",
        "email",
        "role",
        "avatar",
        "resume",
        "companyName",
        "companyDescription",
        "companyLogo",
        "companySize",
        "companyIndustry",
        "companyAddress",
        "companyWebsite",
        "createdAt",
        "updatedAt",
      ],
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return user;
  }

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
