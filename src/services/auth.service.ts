import { AppDataSource } from "../config/database.config";
import { User, UserRole } from "../entities/User.entity";
import { generateTokens, verifyRefreshToken, TokenPayload } from "../utils/token.utils";
import { PasswordUtils } from "../utils/password.utils";
import { ConflictError, UnauthorizedError, NotFoundError } from "../utils/errors";
import { RefreshToken } from "../entities/Refreshtoken.entity";

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
  deviceInfo?: string;
  ipAddress?: string;
}

interface AuthResponse {
  _id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  accessToken: string;
  refreshToken: string;
  resume: string;
}

interface RefreshTokenData {
  refreshToken: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);
  private refreshTokenRepository = AppDataSource.getRepository(RefreshToken);

  /**
   * Register new user
   */
  async register(data: RegisterData, deviceInfo?: string, ipAddress?: string): Promise<AuthResponse> {
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

    return this.buildAuthResponse(user, deviceInfo, ipAddress);
  }

  /**
   * Login user
   */
  async login(data: LoginData): Promise<AuthResponse> {
    const { email, password, deviceInfo, ipAddress } = data;

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Compare password
    const isPasswordValid = await PasswordUtils.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    return this.buildAuthResponse(user, deviceInfo, ipAddress);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(data: RefreshTokenData): Promise<{ accessToken: string; refreshToken: string }> {
    const { refreshToken: token, deviceInfo, ipAddress } = data;

    // Verify refresh token
    let decoded: TokenPayload;
    try {
      decoded = verifyRefreshToken(token) as any;
    } catch (error) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    // Find refresh token in database
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { token, userId: decoded.id },
      relations: ["user"],
    });

    if (!storedToken) {
      throw new UnauthorizedError("Refresh token not found");
    }

    // Check if token is revoked
    if (storedToken.isRevoked) {
      throw new UnauthorizedError("Refresh token has been revoked");
    }

    // Check if token is expired
    if (new Date() > storedToken.expiresAt) {
      throw new UnauthorizedError("Refresh token has expired");
    }

    const user = storedToken.user;

    // Generate new tokens
    const tokenPayload: TokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = generateTokens(tokenPayload);

    // Revoke old refresh token
    storedToken.isRevoked = true;
    await this.refreshTokenRepository.save(storedToken);

    // Store new refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken, deviceInfo, ipAddress);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Logout user (revoke refresh token)
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken, userId },
    });

    if (storedToken && !storedToken.isRevoked) {
      storedToken.isRevoked = true;
      await this.refreshTokenRepository.save(storedToken);
    }
  }

  /**
   * Logout from all devices (revoke all refresh tokens)
   */
  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true }
    );
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<RefreshToken[]> {
    return this.refreshTokenRepository.find({
      where: { userId, isRevoked: false },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(userId: string, tokenId: string): Promise<void> {
    const token = await this.refreshTokenRepository.findOne({
      where: { id: tokenId, userId },
    });

    if (!token) {
      throw new NotFoundError("Session not found");
    }

    token.isRevoked = true;
    await this.refreshTokenRepository.save(token);
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
   * Clean up expired refresh tokens (should be run periodically)
   */
  async cleanupExpiredTokens(): Promise<void> {
    await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where("expiresAt < :now", { now: new Date() })
      .execute();
  }

  /**
   * Build auth response object with tokens
   */
  private async buildAuthResponse(user: User, deviceInfo?: string, ipAddress?: string): Promise<AuthResponse> {
    const tokenPayload: TokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = generateTokens(tokenPayload);

    // Store refresh token in database
    await this.storeRefreshToken(user.id, tokens.refreshToken, deviceInfo, ipAddress);

    return {
      _id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || "",
      role: user.role,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      resume: user.resume || "",
    };
  }

  /**
   * Store refresh token in database
   */
  private async storeRefreshToken(
    userId: string,
    token: string,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<void> {
    // Calculate expiration (7 days by default)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshToken = this.refreshTokenRepository.create({
      token,
      userId,
      expiresAt,
      deviceInfo,
      ipAddress,
    });

    await this.refreshTokenRepository.save(refreshToken);
  }
}

export const authService = new AuthService();