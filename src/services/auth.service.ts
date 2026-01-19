import { AppDataSource } from "../config/database.config";
import { User, UserRole } from "../entities/User.entity";
import { generateToken } from "../utils/token.utils";
import { PasswordUtils } from "../utils/password.utils";
import { ConflictError, UnauthorizedError, NotFoundError } from "../utils/errors";

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
  resume: string;
}

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const { name, email, password, avatar, role } = data;

    // Check if user already exists
    const userExists = await this.userRepository.findOne({ where: { email } });
    if (userExists) {
      throw new ConflictError("User already exists");
    }

    const hashedPassword = await PasswordUtils.hash(password);

    const user = this.userRepository.create({
      name,
      email,
      password: hashedPassword,
      avatar,
      role,
    });

    await this.userRepository.save(user);

    return this.buildAuthResponse(user);
  }

  /**
   * Login user
   */
  async login(data: LoginData): Promise<AuthResponse> {
    const { email, password } = data;

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Compare password
    const isPasswordValid = await PasswordUtils.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    return this.buildAuthResponse(user);
  }

  /**
   * Update user resume URL
   */
  async updateUserResume(userId: string, resumeUrl: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundError("User not found");

    user.resume = resumeUrl;
    await this.userRepository.save(user);

    return resumeUrl;
  }

  /**
   * Build auth response object
   */
  private buildAuthResponse(user: User): AuthResponse {
    return {
      _id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || "",
      role: user.role,
      token: generateToken(user.id),
      resume: user.resume || "",
    };
  }
}

export const authService = new AuthService();