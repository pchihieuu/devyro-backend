import { authEvents } from "../observability/metrics";
import {
  generateTokens,
  verifyRefreshToken,
  decodeToken,
  TokenPayload,
} from "../utils/token.utils";
import { PasswordUtils } from "../utils/password.utils";
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
} from "../utils/errors";
import { emailService } from "./email.service";
import crypto from "crypto";
import { User, UserRole } from "../entities/User.entity";
import { PasswordResetToken } from "../entities/Passwordresettoken.entity";
import {
  authRepository,
  AuthRepository,
} from "../repositories/auth.repository";
import {
  sessionRepository,
  SessionRepository,
  ActiveSession,
} from "../repositories/session.repository";
import { JwtPayload } from "../types/express";

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
  id: string;
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
interface ForgotPasswordData {
  email: string;
}
interface ResetPasswordData {
  token: string;
  newPassword: string;
}

type AccessTokenContext = TokenPayload & { jti?: string; exp?: number };

export class AuthService {
  constructor(
    private readonly authRepo: AuthRepository = authRepository,
    private readonly sessionRepo: SessionRepository = sessionRepository
  ) {}

  // ==================== Authentication ====================

  async register(
    data: RegisterData,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<AuthResponse> {
    const { name, email, password, avatar, role } = data;

    const existingUser = await this.authRepo.findUserByEmail(email);
    if (existingUser)
      throw new ConflictError("User with this email already exists");

    const hashedPassword = await PasswordUtils.hash(password);
    const user = await this.authRepo.createUser({
      name,
      email,
      password: hashedPassword,
      avatar,
      role,
    });

    authEvents.inc({ event: "register" });
    this.sendWelcomeEmailAsync(user.email, user.name);

    return this.buildAuthResponse(user, deviceInfo, ipAddress);
  }

  async login(data: LoginData): Promise<AuthResponse> {
    const { email, password, deviceInfo, ipAddress } = data;

    const user = await this.authRepo.findUserByEmailForLogin(email);
    if (!user) {
      authEvents.inc({ event: "login_failed" });
      throw new UnauthorizedError("Invalid email or password");
    }

    const isPasswordValid = await PasswordUtils.compare(
      password,
      user.password
    );
    if (!isPasswordValid) {
      authEvents.inc({ event: "login_failed" });
      throw new UnauthorizedError("Invalid email or password");
    }

    authEvents.inc({ event: "login_success" });
    return this.buildAuthResponse(user, deviceInfo, ipAddress);
  }

  /**
   * Refresh Token Rotation:
   * 1. Verify chữ ký + hạn JWT.
   * 2. Check jti còn tồn tại trong Redis (chưa bị revoke/rotate trước đó).
   * 3. Nếu hợp lệ: xóa session cũ, cấp access token + refresh token (jti) mới, lưu session mới.
   */
  async refreshAccessToken(
    data: RefreshTokenData
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { refreshToken: token, deviceInfo, ipAddress } = data;

    let decoded: JwtPayload;
    try {
      decoded = verifyRefreshToken(token) as JwtPayload;
    } catch (error) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    if (!decoded.jti) {
      throw new UnauthorizedError("Malformed refresh token");
    }

    const isValid = await this.sessionRepo.isRefreshSessionValid(
      decoded.id,
      decoded.jti
    );
    if (!isValid) {
      // jti không còn trong Redis -> đã logout / đã rotate / bị revoke thủ công
      throw new UnauthorizedError(
        "Refresh token not found or has been revoked"
      );
    }

    const user = await this.authRepo.findUserById(decoded.id);
    if (!user) throw new UnauthorizedError("User no longer exists");

    // Rotation: hủy session cũ trước khi cấp session mới, tránh 1 refresh token dùng được nhiều lần
    await this.sessionRepo.revokeRefreshSession(decoded.id, decoded.jti);

    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await this.sessionRepo.storeRefreshSession(
      user.id,
      tokens.refreshJti,
      tokens.refreshExpiresInSeconds,
      {
        deviceInfo,
        ipAddress,
      }
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // ==================== Logout ====================

  /**
   * Logout 1 thiết bị: DEL session refresh token trong Redis + blacklist access token hiện tại.
   * Cho phép logout kể cả khi refresh token đã hết hạn (verify fail) bằng cách fallback decode
   * (không verify) để vẫn lấy được jti và dọn key — tránh rác vĩnh viễn nếu client gọi logout trễ.
   */
  async logout(
    userId: string,
    refreshToken: string,
    accessTokenContext?: AccessTokenContext
  ): Promise<void> {
    let jti: string | undefined;
    try {
      jti = (verifyRefreshToken(refreshToken) as JwtPayload).jti;
    } catch {
      jti = (decodeToken(refreshToken) as JwtPayload | null)?.jti;
    }

    if (jti) {
      await this.sessionRepo.revokeRefreshSession(userId, jti);
    }

    if (accessTokenContext?.jti && accessTokenContext.exp) {
      const ttlSeconds = accessTokenContext.exp - Math.floor(Date.now() / 1000);
      await this.sessionRepo.blacklistAccessToken(
        accessTokenContext.jti,
        ttlSeconds
      );
    }
  }

  /** Logout tất cả thiết bị: xóa toàn bộ session Redis + đánh dấu access token cũ vô hiệu */
  async logoutAll(userId: string): Promise<void> {
    await this.sessionRepo.revokeAllRefreshSessions(userId);
    await this.sessionRepo.invalidateAllSessionsBefore(userId);
  }

  // ==================== Session Management ====================

  async getActiveSessions(userId: string): Promise<ActiveSession[]> {
    return this.sessionRepo.listActiveRefreshSessions(userId);
  }

  async revokeSession(userId: string, tokenId: string): Promise<void> {
    const isValid = await this.sessionRepo.isRefreshSessionValid(
      userId,
      tokenId
    );
    if (!isValid) throw new NotFoundError("Session not found");

    await this.sessionRepo.revokeRefreshSession(userId, tokenId);
  }

  // ==================== Password Reset ====================
  // (giữ nguyên forgotPassword / resetPassword / verifyResetToken như code gốc,
  //  chỉ đổi 1 chỗ trong resetPassword: gọi this.logoutAll(user.id) vẫn hoạt động y hệt)

  async forgotPassword(data: ForgotPasswordData): Promise<void> {
    const { email } = data;
    const user = await this.authRepo.findUserByEmail(email);
    if (!user) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return;
    }

    const resetToken = this.generateSecureToken();
    const hashedToken = this.hashToken(resetToken);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.authRepo.invalidateExistingResetTokens(user.id);
    await this.authRepo.createResetToken({
      token: hashedToken,
      userId: user.id,
      expiresAt,
      isUsed: false,
    });
    await this.sendPasswordResetEmailAsync(user.email, user.name, resetToken);
  }

  async resetPassword(data: ResetPasswordData): Promise<void> {
    const { token, newPassword } = data;
    const resetToken = await this.findAndValidateResetToken(token);
    const userId = resetToken.user.id;

    const user = await this.authRepo.findUserById(userId);
    if (!user) throw new NotFoundError("User not found");

    user.password = await PasswordUtils.hash(newPassword);
    await this.authRepo.saveUser(user);

    resetToken.isUsed = true;
    await this.authRepo.saveResetToken(resetToken);

    await this.logoutAll(user.id);

    this.sendPasswordChangedEmailAsync(user.email, user.name);
  }

  async verifyResetToken(token: string): Promise<boolean> {
    try {
      await this.findAndValidateResetToken(token);
      return true;
    } catch {
      return false;
    }
  }

  // ==================== User Profile ====================

  async updateUserResume(userId: string, resumeUrl: string): Promise<string> {
    const user = await this.authRepo.findUserById(userId);
    if (!user) throw new NotFoundError("User not found");

    user.resume = resumeUrl;
    await this.authRepo.saveUser(user);
    await this.sessionRepo.clearUserSessionCache(userId);

    return resumeUrl;
  }

  // ==================== Cleanup ====================
  // cleanupExpiredTokens() ĐÃ BỊ XÓA — Redis TTL tự dọn refresh session, không cần cron nữa.

  async cleanupExpiredResetTokens(): Promise<void> {
    const result = await this.authRepo.deleteExpiredResetTokens();
    console.log(
      `Cleaned up ${result.affected || 0} expired/used password reset tokens`
    );
  }

  // ==================== Private Helper Methods ====================

  private async buildAuthResponse(
    user: User,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<AuthResponse> {
    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await this.sessionRepo.storeRefreshSession(
      user.id,
      tokens.refreshJti,
      tokens.refreshExpiresInSeconds,
      {
        deviceInfo,
        ipAddress,
      }
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || "",
      role: user.role,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      resume: user.resume || "",
    };
  }

  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private async findAndValidateResetToken(
    token: string
  ): Promise<PasswordResetToken> {
    const hashedToken = this.hashToken(token);
    const resetToken = await this.authRepo.findResetTokenByHash(hashedToken);

    if (!resetToken)
      throw new BadRequestError("Invalid or expired password reset token");
    if (resetToken.isUsed)
      throw new BadRequestError(
        "This password reset token has already been used"
      );
    if (new Date() > resetToken.expiresAt)
      throw new BadRequestError("Password reset token has expired");

    return resetToken;
  }

  private sendWelcomeEmailAsync(email: string, name: string): void {
    emailService.sendWelcomeEmail(email, name).catch((error) => {
      console.error(`Failed to send welcome email to ${email}:`, error);
    });
  }

  private async sendPasswordResetEmailAsync(
    email: string,
    name: string,
    token: string
  ): Promise<void> {
    try {
      await emailService.sendPasswordResetEmail(email, name, token);
    } catch (error) {
      console.error(`Failed to send password reset email to ${email}:`, error);
      throw new Error(
        "Failed to send password reset email. Please try again later."
      );
    }
  }

  private sendPasswordChangedEmailAsync(email: string, name: string): void {
    emailService.sendPasswordChangedEmail(email, name).catch((error) => {
      console.error(
        `Failed to send password changed email to ${email}:`,
        error
      );
    });
  }
}

export const authService = new AuthService();
