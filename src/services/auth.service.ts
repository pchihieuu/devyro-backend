import { AppDataSource } from "../config/database.config";
import { User, UserRole } from "../entities/User.entity";
import { generateToken } from "../utils/token.utils";
import {
  ConflictError,
  UnauthorizedError,
  BadRequestError,
  NotFoundError,
} from "../utils/errors";
import { uploadToCloudinary } from "../utils/cloudinary.utils";

interface RegisterData {
  name: string;
  email: string;
  password: string;
  avatar?: string;
  role: UserRole;
}

interface LoginData {
  email: string;
  password: string;
}

interface AuthResponse {
  _id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  token: string;
  companyName: string;
  companyDescription: string;
  companyLogo: string;
  resume: string;
}

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);

  async register(data: RegisterData): Promise<AuthResponse> {
    const { name, email, password, avatar, role } = data;

    // Check if user already exists
    const userExists = await this.userRepository.findOne({ where: { email } });
    if (userExists) {
      throw new ConflictError("User already exists");
    }

    const user = this.userRepository.create({
      name,
      email,
      password,
      avatar,
      role,
    });

    await this.userRepository.save(user);

    return {
      _id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      token: generateToken(user.id),
      companyName: user.companyName || "",
      companyDescription: user.companyDescription || "",
      companyLogo: user.companyLogo || "",
      resume: user.resume || "",
    };
  }

  async login(data: LoginData): Promise<AuthResponse> {
    const { email, password } = data;

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || !(await user.comparePassword(password))) {
      throw new UnauthorizedError("Invalid email or password");
    }

    return {
      _id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      token: generateToken(user.id),
      companyName: user.companyName || "",
      companyDescription: user.companyDescription || "",
      companyLogo: user.companyLogo || "",
      resume: user.resume || "",
    };
  }

  async uploadImage(
    fileBuffer: Buffer,
    mimetype: string
  ): Promise<{ imageUrl: string; publicId: string }> {
    if (!fileBuffer) {
      throw new BadRequestError("No file provided");
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(mimetype)) {
      throw new BadRequestError(
        "Invalid file type. Only JPEG, JPG, and PNG are allowed"
      );
    }

    const result = await uploadToCloudinary(
      fileBuffer,
      "job-portal/images",
      "image"
    );

    return {
      imageUrl: result.secure_url,
      publicId: result.public_id,
    };
  }

  async uploadResume(
    userId: string,
    fileBuffer: Buffer,
    mimetype: string
  ): Promise<{ resumeUrl: string }> {
    if (mimetype !== "application/pdf") {
      throw new BadRequestError("Only PDF files are allowed for resume");
    }

    const result = await uploadToCloudinary(
      fileBuffer,
      "job-portal/resumes",
      "raw"
    );

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundError("User not found");

    user.resume = result.secure_url;
    await this.userRepository.save(user);

    return { resumeUrl: result.secure_url };
  }
}

export const authService = new AuthService();
