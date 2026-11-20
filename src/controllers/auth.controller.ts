import { authEvents } from "../observability/metrics";
import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { uploadService } from "../services/upload.service";
import { userService } from "../services/user.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/api-response";
import { BadRequestError, UnauthorizedError } from "../utils/errors";
import { config } from "../config/env.config";

/**
 * Get device info from request
 */
const getDeviceInfo = (req: Request): string => {
  return req.headers["user-agent"] || "Unknown Device";
};

/**
 * Get IP address from request
 */
const getIpAddress = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    req.socket.remoteAddress ||
    "Unknown IP"
  );
};

/**
 * Set secure httpOnly cookie for refresh token
 */
const setRefreshTokenCookie = (res: Response, refreshToken: string) => {
  const isProduction = config.nodeEnv === "production";

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true, // luôn true vì Render dùng HTTPS
    sameSite: isProduction ? "none" : "lax", // none cho cross-origin production
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
};

/**
 * Clear refresh token cookie
 */
const clearRefreshTokenCookie = (res: Response) => {
  const isProduction = config.nodeEnv === "production";

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });
};

export const register = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const deviceInfo = getDeviceInfo(req);
    const ipAddress = getIpAddress(req);

    const result = await authService.register(req.body, deviceInfo, ipAddress);

    setRefreshTokenCookie(res, result.refreshToken);

    const { refreshToken, ...userData } = result;

    ApiResponse.created(
      res,
      userData,
      "User registered successfully. Welcome email sent to your inbox."
    );
  }
);

export const login = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const deviceInfo = getDeviceInfo(req);
    const ipAddress = getIpAddress(req);

    try {
      const result = await authService.login({
        ...req.body,
        deviceInfo,
        ipAddress,
      });

      setRefreshTokenCookie(res, result.refreshToken);

      const { refreshToken, ...userData } = result;

      ApiResponse.ok(res, userData, "Login successful");
    } catch (error) {
      clearRefreshTokenCookie(res);
      throw error;
    }
  }
);

export const refreshToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedError(
        "Refresh token not found",
        "REFRESH_TOKEN_MISSING"
      );
    }

    try {
      const deviceInfo = getDeviceInfo(req);
      const ipAddress = getIpAddress(req);

      const tokens = await authService.refreshAccessToken({
        refreshToken,
        deviceInfo,
        ipAddress,
      });

      setRefreshTokenCookie(res, tokens.refreshToken);

      ApiResponse.ok(
        res,
        { accessToken: tokens.accessToken },
        "Token refreshed successfully"
      );
    } catch (error) {
      authEvents.inc({ event: "refresh_failed" });
      clearRefreshTokenCookie(res);
      throw error;
    }
  }
);

export const logout = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken && req.user) {
      await authService.logout(req.user.id, refreshToken, req.tokenPayload);
    }

    clearRefreshTokenCookie(res);

    ApiResponse.message(res, "Logged out successfully");
  }
);

export const logoutAll = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new BadRequestError("User not authenticated");
    }

    await authService.logoutAll(req.user.id);

    clearRefreshTokenCookie(res);

    ApiResponse.message(res, "Logged out from all devices successfully");
  }
);

export const getActiveSessions = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new BadRequestError("User not authenticated");
    }

    const sessions = await authService.getActiveSessions(req.user.id);

    ApiResponse.ok(res, sessions);
  }
);

export const revokeSession = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new BadRequestError("User not authenticated");
    }

    const { tokenId } = req.params;

    await authService.revokeSession(req.user.id, tokenId);

    ApiResponse.message(res, "Session revoked successfully");
  }
);

export const getMe = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError("User not authenticated");
    }
    const user = await userService.getMyProfile(req.user.id);

    ApiResponse.ok(res, user);
  }
);

export const uploadImagePublic = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new BadRequestError("No file uploaded");
    }

    const result = await uploadService.uploadImage(
      req.file.buffer,
      req.file.mimetype
    );

    ApiResponse.created(
      res,
      { imageUrl: result.url, publicId: result.publicId },
      "Image uploaded successfully"
    );
  }
);

export const uploadImage = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) throw new BadRequestError("No file uploaded");
    if (!req.user) throw new UnauthorizedError("User not authenticated");

    const result = await uploadService.uploadImage(
      req.file.buffer,
      req.file.mimetype
    );

    ApiResponse.created(
      res,
      { imageUrl: result.url, publicId: result.publicId },
      "Image uploaded successfully"
    );

    userService.updateAvatar(req.user.id, result.url).catch((err) => {
      console.error("Failed to update user avatar:", err);
    });
  }
);

export const uploadResume = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) throw new BadRequestError("No file uploaded");
    if (!req.user) throw new UnauthorizedError("User not authenticated");

    const result = await uploadService.uploadResume(
      req.file.buffer,
      req.file.mimetype
    );

    ApiResponse.created(
      res,
      { resumeUrl: result.url, publicId: result.publicId },
      "Resume uploaded successfully"
    );

    userService.updateResume(req.user.id, result.url).catch((err) => {
      console.error("Failed to update user resume:", err);
    });
  }
);

/**
 * Forgot Password - Send reset email
 */
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;

    await authService.forgotPassword({ email });

    ApiResponse.message(
      res,
      "If an account exists with this email, a password reset link has been sent."
    );
  }
);

/**
 * Reset Password - Using token from email
 */
export const resetPassword = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { token, newPassword } = req.body;

    await authService.resetPassword({ token, newPassword });

    ApiResponse.message(
      res,
      "Password has been reset successfully. Please login with your new password."
    );
  }
);

/**
 * Verify Reset Token - Check if token is valid
 */
export const verifyResetToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { token } = req.params;

    const isValid = await authService.verifyResetToken(token);

    if (!isValid) {
      throw new BadRequestError("Invalid or expired password reset token");
    }

    ApiResponse.message(res, "Token is valid");
  }
);
