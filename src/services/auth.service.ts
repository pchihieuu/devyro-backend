// import { AppDataSource } from "../config/database.config";
// import { User, UserRole } from "../entities/User.entity";
// import {
//   generateTokens,
//   verifyRefreshToken,
//   TokenPayload,
// } from "../utils/token.utils";
// import { PasswordUtils } from "../utils/password.utils";
// import {
//   ConflictError,
//   UnauthorizedError,
//   NotFoundError,
//   BadRequestError,
// } from "../utils/errors";
// import { RefreshToken } from "../entities/Refreshtoken.entity";
// import { emailService } from "../config/email.config";
// import crypto from "crypto";
// import { PasswordResetToken } from "../entities/Passwordresettoken.entity";

// interface RegisterData {
//   name: string;
//   email: string;
//   password: string;
//   avatar?: string;
//   role: UserRole;
// }

// interface LoginData {
//   email: string;
//   password: string;
//   deviceInfo?: string;
//   ipAddress?: string;
// }

// interface AuthResponse {
//   _id: string;
//   name: string;
//   email: string;
//   avatar: string;
//   role: UserRole;
//   accessToken: string;
//   refreshToken: string;
//   resume: string;
// }

// interface RefreshTokenData {
//   refreshToken: string;
//   deviceInfo?: string;
//   ipAddress?: string;
// }

// interface ForgotPasswordData {
//   email: string;
// }

// interface ResetPasswordData {
//   token: string;
//   newPassword: string;
// }

// export class AuthService {
//   private userRepository = AppDataSource.getRepository(User);
//   private refreshTokenRepository = AppDataSource.getRepository(RefreshToken);
//   private passwordResetTokenRepository =
//     AppDataSource.getRepository(PasswordResetToken);

//   /**
//    * Register new user
//    */
//   async register(
//     data: RegisterData,
//     deviceInfo?: string,
//     ipAddress?: string
//   ): Promise<AuthResponse> {
//     const { name, email, password, avatar, role } = data;

//     // Check if user already exists
//     const userExists = await this.userRepository.findOne({ where: { email } });
//     if (userExists) {
//       throw new ConflictError("User already exists");
//     }

//     const hashedPassword = await PasswordUtils.hash(password);

//     const user = this.userRepository.create({
//       name,
//       email,
//       password: hashedPassword,
//       avatar,
//       role,
//     });

//     await this.userRepository.save(user);

//     // Send welcome email (async, don't wait)
//     emailService.sendWelcomeEmail(user.email, user.name).catch((error) => {
//       console.error("Failed to send welcome email:", error);
//     });

//     return this.buildAuthResponse(user, deviceInfo, ipAddress);
//   }

//   /**
//    * Login user
//    */
//   async login(data: LoginData): Promise<AuthResponse> {
//     const { email, password, deviceInfo, ipAddress } = data;

//     const user = await this.userRepository.findOne({ where: { email } });

//     if (!user) {
//       throw new UnauthorizedError("Invalid email or password");
//     }

//     // Compare password
//     const isPasswordValid = await PasswordUtils.compare(
//       password,
//       user.password
//     );
//     if (!isPasswordValid) {
//       throw new UnauthorizedError("Invalid email or password");
//     }

//     return this.buildAuthResponse(user, deviceInfo, ipAddress);
//   }

//   /**
//    * Refresh access token using refresh token
//    */
//   async refreshAccessToken(
//     data: RefreshTokenData
//   ): Promise<{ accessToken: string; refreshToken: string }> {
//     const { refreshToken: token, deviceInfo, ipAddress } = data;

//     // Verify refresh token
//     let decoded: TokenPayload;
//     try {
//       decoded = verifyRefreshToken(token) as any;
//     } catch (error) {
//       throw new UnauthorizedError("Invalid or expired refresh token");
//     }

//     // Find refresh token in database
//     const storedToken = await this.refreshTokenRepository.findOne({
//       where: { token, userId: decoded.id },
//       relations: ["user"],
//     });

//     if (!storedToken) {
//       throw new UnauthorizedError("Refresh token not found");
//     }

//     // Check if token is revoked
//     if (storedToken.isRevoked) {
//       throw new UnauthorizedError("Refresh token has been revoked");
//     }

//     // Check if token is expired
//     if (new Date() > storedToken.expiresAt) {
//       throw new UnauthorizedError("Refresh token has expired");
//     }

//     const user = storedToken.user;

//     // Generate new tokens
//     const tokenPayload: TokenPayload = {
//       id: user.id,
//       email: user.email,
//       role: user.role,
//     };

//     const tokens = generateTokens(tokenPayload);

//     // Revoke old refresh token
//     storedToken.isRevoked = true;
//     await this.refreshTokenRepository.save(storedToken);

//     // Store new refresh token
//     await this.storeRefreshToken(
//       user.id,
//       tokens.refreshToken,
//       deviceInfo,
//       ipAddress
//     );

//     return {
//       accessToken: tokens.accessToken,
//       refreshToken: tokens.refreshToken,
//     };
//   }

//   /**
//    * Logout user (revoke refresh token)
//    */
//   async logout(userId: string, refreshToken: string): Promise<void> {
//     const storedToken = await this.refreshTokenRepository.findOne({
//       where: { token: refreshToken, userId },
//     });

//     if (storedToken && !storedToken.isRevoked) {
//       storedToken.isRevoked = true;
//       await this.refreshTokenRepository.save(storedToken);
//     }
//   }

//   /**
//    * Logout from all devices (revoke all refresh tokens)
//    */
//   async logoutAll(userId: string): Promise<void> {
//     await this.refreshTokenRepository.update(
//       { userId, isRevoked: false },
//       { isRevoked: true }
//     );
//   }

//   /**
//    * Get active sessions for a user
//    */
//   async getActiveSessions(userId: string): Promise<RefreshToken[]> {
//     return this.refreshTokenRepository.find({
//       where: { userId, isRevoked: false },
//       order: { createdAt: "DESC" },
//     });
//   }

//   /**
//    * Revoke a specific session
//    */
//   async revokeSession(userId: string, tokenId: string): Promise<void> {
//     const token = await this.refreshTokenRepository.findOne({
//       where: { id: tokenId, userId },
//     });

//     if (!token) {
//       throw new NotFoundError("Session not found");
//     }

//     token.isRevoked = true;
//     await this.refreshTokenRepository.save(token);
//   }

//   /**
//    * Update user resume URL
//    */
//   async updateUserResume(userId: string, resumeUrl: string): Promise<string> {
//     const user = await this.userRepository.findOne({ where: { id: userId } });
//     if (!user) throw new NotFoundError("User not found");

//     user.resume = resumeUrl;
//     await this.userRepository.save(user);

//     return resumeUrl;
//   }

//   /**
//    * Request password reset - generates token and sends email
//    */
//   async forgotPassword(data: ForgotPasswordData): Promise<void> {
//     const { email } = data;

//     const user = await this.userRepository.findOne({ where: { email } });

//     // Don't reveal if user exists or not for security
//     if (!user) {
//       console.log(`Password reset requested for non-existent email: ${email}`);
//       return;
//     }

//     // Generate secure random token
//     const resetToken = crypto.randomBytes(32).toString("hex");

//     // Hash token before storing in database
//     const hashedToken = crypto
//       .createHash("sha256")
//       .update(resetToken)
//       .digest("hex");

//     // Set expiration to 1 hour from now
//     const expiresAt = new Date();
//     expiresAt.setHours(expiresAt.getHours() + 1);

//     // Invalidate any existing password reset tokens for this user
//     await this.passwordResetTokenRepository.update(
//       { userId: user.id, isUsed: false },
//       { isUsed: true }
//     );

//     // Create new password reset token
//     const passwordResetToken = this.passwordResetTokenRepository.create({
//       token: hashedToken,
//       userId: user.id,
//       expiresAt,
//       isUsed: false,
//     });

//     await this.passwordResetTokenRepository.save(passwordResetToken);

//     // Send password reset email with unhashed token
//     try {
//       await emailService.sendPasswordResetEmail(
//         user.email,
//         user.name,
//         resetToken
//       );
//     } catch (error) {
//       console.error("Failed to send password reset email:", error);
//       throw new Error("Failed to send password reset email");
//     }
//   }

//   /**
//    * Reset password using token
//    */
//   async resetPassword(data: ResetPasswordData): Promise<void> {
//     const { token, newPassword } = data;

//     // Hash the token to compare with stored hash
//     const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

//     // Find the token in database
//     const resetToken = await this.passwordResetTokenRepository.findOne({
//       where: { token: hashedToken },
//       relations: ["user"],
//     });

//     if (!resetToken) {
//       throw new BadRequestError("Invalid or expired password reset token");
//     }

//     // Check if token is already used
//     if (resetToken.isUsed) {
//       throw new BadRequestError("Password reset token has already been used");
//     }

//     // Check if token is expired
//     if (new Date() > resetToken.expiresAt) {
//       throw new BadRequestError("Password reset token has expired");
//     }

//     const user = resetToken.user;

//     // Hash new password
//     const hashedPassword = await PasswordUtils.hash(newPassword);

//     // Update user password
//     user.password = hashedPassword;
//     await this.userRepository.save(user);

//     // Mark token as used
//     resetToken.isUsed = true;
//     await this.passwordResetTokenRepository.save(resetToken);

//     // Revoke all refresh tokens (logout from all devices for security)
//     await this.logoutAll(user.id);

//     // Send password changed confirmation email
//     emailService
//       .sendPasswordChangedEmail(user.email, user.name)
//       .catch((error) => {
//         console.error("Failed to send password changed email:", error);
//       });
//   }

//   /**
//    * Verify password reset token validity
//    */
//   async verifyResetToken(token: string): Promise<boolean> {
//     const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

//     const resetToken = await this.passwordResetTokenRepository.findOne({
//       where: { token: hashedToken },
//     });

//     if (!resetToken) {
//       return false;
//     }

//     if (resetToken.isUsed) {
//       return false;
//     }

//     if (new Date() > resetToken.expiresAt) {
//       return false;
//     }

//     return true;
//   }

//   /**
//    * Clean up expired refresh tokens (should be run periodically)
//    */
//   async cleanupExpiredTokens(): Promise<void> {
//     await this.refreshTokenRepository
//       .createQueryBuilder()
//       .delete()
//       .where("expiresAt < :now", { now: new Date() })
//       .execute();
//   }

//   /**
//    * Clean up expired password reset tokens (should be run periodically)
//    */
//   async cleanupExpiredResetTokens(): Promise<void> {
//     await this.passwordResetTokenRepository
//       .createQueryBuilder()
//       .delete()
//       .where("expiresAt < :now OR isUsed = :isUsed", {
//         now: new Date(),
//         isUsed: true,
//       })
//       .execute();
//   }

//   /**
//    * Build auth response object with tokens
//    */
//   private async buildAuthResponse(
//     user: User,
//     deviceInfo?: string,
//     ipAddress?: string
//   ): Promise<AuthResponse> {
//     const tokenPayload: TokenPayload = {
//       id: user.id,
//       email: user.email,
//       role: user.role,
//     };

//     const tokens = generateTokens(tokenPayload);

//     // Store refresh token in database
//     await this.storeRefreshToken(
//       user.id,
//       tokens.refreshToken,
//       deviceInfo,
//       ipAddress
//     );

//     return {
//       _id: user.id,
//       name: user.name,
//       email: user.email,
//       avatar: user.avatar || "",
//       role: user.role,
//       accessToken: tokens.accessToken,
//       refreshToken: tokens.refreshToken,
//       resume: user.resume || "",
//     };
//   }

//   /**
//    * Store refresh token in database
//    */
//   private async storeRefreshToken(
//     userId: string,
//     token: string,
//     deviceInfo?: string,
//     ipAddress?: string
//   ): Promise<void> {
//     // Calculate expiration (7 days by default)
//     const expiresAt = new Date();
//     expiresAt.setDate(expiresAt.getDate() + 7);

//     const refreshToken = this.refreshTokenRepository.create({
//       token,
//       userId,
//       expiresAt,
//       deviceInfo,
//       ipAddress,
//     });

//     await this.refreshTokenRepository.save(refreshToken);
//   }
// }

// export const authService = new AuthService();

import { AppDataSource } from "../config/database.config";
import { User, UserRole } from "../entities/User.entity";
import {
  generateTokens,
  verifyRefreshToken,
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
import { RefreshToken } from "../entities/Refreshtoken.entity";
import { PasswordResetToken } from "../entities/Passwordresettoken.entity";

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

interface ForgotPasswordData {
  email: string;
}

interface ResetPasswordData {
  token: string;
  newPassword: string;
}

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);
  private refreshTokenRepository = AppDataSource.getRepository(RefreshToken);
  private passwordResetTokenRepository =
    AppDataSource.getRepository(PasswordResetToken);

  // ==================== Authentication ====================

  /**
   * Register new user
   */
  async register(
    data: RegisterData,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<AuthResponse> {
    const { name, email, password, avatar, role } = data;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictError("User with this email already exists");
    }

    // Hash password
    const hashedPassword = await PasswordUtils.hash(password);

    // Create user
    const user = this.userRepository.create({
      name,
      email,
      password: hashedPassword,
      avatar,
      role,
    });

    await this.userRepository.save(user);

    // Send welcome email (async - don't wait)
    this.sendWelcomeEmailAsync(user.email, user.name);

    // Build auth response with tokens
    return this.buildAuthResponse(user, deviceInfo, ipAddress);
  }

  /**
   * Login user
   */
  async login(data: LoginData): Promise<AuthResponse> {
    const { email, password, deviceInfo, ipAddress } = data;

    // Find user
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Verify password
    const isPasswordValid = await PasswordUtils.compare(
      password,
      user.password
    );
    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    return this.buildAuthResponse(user, deviceInfo, ipAddress);
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(
    data: RefreshTokenData
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { refreshToken: token, deviceInfo, ipAddress } = data;

    // Verify refresh token
    let decoded: TokenPayload;
    try {
      decoded = verifyRefreshToken(token) as TokenPayload;
    } catch (error) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    // Find token in database
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { token, userId: decoded.id },
      relations: ["user"],
    });

    if (!storedToken) {
      throw new UnauthorizedError("Refresh token not found");
    }

    // Validate token
    this.validateRefreshToken(storedToken);

    const user = storedToken.user;

    // Generate new tokens
    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Revoke old token and store new one
    await this.rotateRefreshToken(
      storedToken,
      user.id,
      tokens.refreshToken,
      deviceInfo,
      ipAddress
    );

    return tokens;
  }

  // ==================== Logout ====================

  /**
   * Logout user from current device
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
   * Logout user from all devices
   */
  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true }
    );
  }

  // ==================== Session Management ====================

  /**
   * Get active sessions for user
   */
  async getActiveSessions(userId: string): Promise<RefreshToken[]> {
    return this.refreshTokenRepository.find({
      where: { userId, isRevoked: false },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Revoke specific session
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

  // ==================== Password Reset ====================

  /**
   * Request password reset
   */
  async forgotPassword(data: ForgotPasswordData): Promise<void> {
    const { email } = data;

    const user = await this.userRepository.findOne({ where: { email } });

    // Don't reveal if user exists (security best practice)
    if (!user) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return;
    }

    // Generate secure token
    const resetToken = this.generateSecureToken();
    const hashedToken = this.hashToken(resetToken);

    // Set expiration (1 hour)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Invalidate existing tokens
    await this.invalidateExistingResetTokens(user.id);

    // Create new reset token
    const passwordResetToken = this.passwordResetTokenRepository.create({
      token: hashedToken,
      userId: user.id,
      expiresAt,
      isUsed: false,
    });

    await this.passwordResetTokenRepository.save(passwordResetToken);

    // Send reset email
    await this.sendPasswordResetEmailAsync(user.email, user.name, resetToken);
  }

  /**
   * Reset password with token
   */
  async resetPassword(data: ResetPasswordData): Promise<void> {
    const { token, newPassword } = data;

    // Find and validate token
    const resetToken = await this.findAndValidateResetToken(token);

    // Get user
    const user = resetToken.user;

    // Hash new password
    const hashedPassword = await PasswordUtils.hash(newPassword);

    // Update password
    user.password = hashedPassword;
    await this.userRepository.save(user);

    // Mark token as used
    resetToken.isUsed = true;
    await this.passwordResetTokenRepository.save(resetToken);

    // Logout from all devices (security measure)
    await this.logoutAll(user.id);

    // Send confirmation email
    this.sendPasswordChangedEmailAsync(user.email, user.name);
  }

  /**
   * Verify reset token validity
   */
  async verifyResetToken(token: string): Promise<boolean> {
    try {
      await this.findAndValidateResetToken(token);
      return true;
    } catch (error) {
      return false;
    }
  }

  // ==================== User Profile ====================

  /**
   * Update user resume
   */
  async updateUserResume(userId: string, resumeUrl: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    user.resume = resumeUrl;
    await this.userRepository.save(user);

    return resumeUrl;
  }

  // ==================== Cleanup ====================

  /**
   * Clean up expired refresh tokens
   */
  async cleanupExpiredTokens(): Promise<void> {
    const result = await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where("expiresAt < :now", { now: new Date() })
      .execute();

    console.log(`Cleaned up ${result.affected || 0} expired refresh tokens`);
  }

  /**
   * Clean up expired password reset tokens
   */
  async cleanupExpiredResetTokens(): Promise<void> {
    const result = await this.passwordResetTokenRepository
      .createQueryBuilder()
      .delete()
      .where("expiresAt < :now OR isUsed = :isUsed", {
        now: new Date(),
        isUsed: true,
      })
      .execute();

    console.log(
      `Cleaned up ${result.affected || 0} expired/used password reset tokens`
    );
  }

  // ==================== Private Helper Methods ====================

  /**
   * Build authentication response with tokens
   */
  private async buildAuthResponse(
    user: User,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<AuthResponse> {
    const tokenPayload: TokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = generateTokens(tokenPayload);

    // Store refresh token
    await this.storeRefreshToken(
      user.id,
      tokens.refreshToken,
      deviceInfo,
      ipAddress
    );

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
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const refreshToken = this.refreshTokenRepository.create({
      token,
      userId,
      expiresAt,
      deviceInfo,
      ipAddress,
    });

    await this.refreshTokenRepository.save(refreshToken);
  }

  /**
   * Validate refresh token
   */
  private validateRefreshToken(token: RefreshToken): void {
    if (token.isRevoked) {
      throw new UnauthorizedError("Refresh token has been revoked");
    }

    if (new Date() > token.expiresAt) {
      throw new UnauthorizedError("Refresh token has expired");
    }
  }

  /**
   * Rotate refresh token (revoke old, create new)
   */
  private async rotateRefreshToken(
    oldToken: RefreshToken,
    userId: string,
    newToken: string,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<void> {
    // Revoke old token
    oldToken.isRevoked = true;
    await this.refreshTokenRepository.save(oldToken);

    // Store new token
    await this.storeRefreshToken(userId, newToken, deviceInfo, ipAddress);
  }

  /**
   * Generate secure random token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Hash token using SHA256
   */
  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Invalidate existing password reset tokens
   */
  private async invalidateExistingResetTokens(userId: string): Promise<void> {
    await this.passwordResetTokenRepository.update(
      { userId, isUsed: false },
      { isUsed: true }
    );
  }

  /**
   * Find and validate password reset token
   */
  private async findAndValidateResetToken(
    token: string
  ): Promise<PasswordResetToken> {
    const hashedToken = this.hashToken(token);

    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: { token: hashedToken },
      relations: ["user"],
    });

    if (!resetToken) {
      throw new BadRequestError("Invalid or expired password reset token");
    }

    if (resetToken.isUsed) {
      throw new BadRequestError(
        "This password reset token has already been used"
      );
    }

    if (new Date() > resetToken.expiresAt) {
      throw new BadRequestError("Password reset token has expired");
    }

    return resetToken;
  }

  // ==================== Email Helpers ====================

  /**
   * Send welcome email (async)
   */
  private sendWelcomeEmailAsync(email: string, name: string): void {
    emailService.sendWelcomeEmail(email, name).catch((error) => {
      console.error(`Failed to send welcome email to ${email}:`, error);
    });
  }

  /**
   * Send password reset email (async)
   */
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

  /**
   * Send password changed email (async)
   */
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
