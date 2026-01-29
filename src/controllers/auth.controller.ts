import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { uploadService } from "../services/upload.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HTTP_STATUS } from "../constants/httpStatus";
import { BadRequestError } from "../utils/errors";
import { success } from "zod";

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

export const register = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const deviceInfo = getDeviceInfo(req);
    const ipAddress = getIpAddress(req);

    const user = await authService.register(req.body, deviceInfo, ipAddress);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "User registered successfully",
      data: user,
    });
  }
);

export const login = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const deviceInfo = getDeviceInfo(req);
    const ipAddress = getIpAddress(req);

    const user = await authService.login({
      ...req.body,
      deviceInfo,
      ipAddress,
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Login successful",
      data: user,
    });
  }
);

export const refreshToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new BadRequestError("Refresh token is required");
    }

    const deviceInfo = getDeviceInfo(req);
    const ipAddress = getIpAddress(req);

    const tokens = await authService.refreshAccessToken({
      refreshToken,
      deviceInfo,
      ipAddress,
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Token refreshed successfully",
      data: tokens,
    });
  }
);

export const logout = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;

    if (refreshToken && req.user) {
      await authService.logout(req.user.id, refreshToken);
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Logged out successfully",
    });
  }
);

export const logoutAll = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new BadRequestError("User not authenticated");
    }

    await authService.logoutAll(req.user.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Logged out from all devices successfully",
    });
  }
);

export const getActiveSessions = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new BadRequestError("User not authenticated");
    }

    const sessions = await authService.getActiveSessions(req.user.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: sessions,
    });
  }
);

export const revokeSession = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new BadRequestError("User not authenticated");
    }

    const { tokenId } = req.params;

    await authService.revokeSession(req.user.id, tokenId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Session revoked successfully",
    });
  }
);

export const getMe = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: req.user,
    });
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

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Image uploaded successfully",
      data: {
        imageUrl: result.url,
        publicId: result.publicId,
      },
    });
  }
);
export const uploadImage = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new BadRequestError("No file uploaded");
    }

    const result = await uploadService.uploadImage(
      req.file.buffer,
      req.file.mimetype
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Image uploaded successfully",
      data: {
        imageUrl: result.url,
        publicId: result.publicId,
      },
    });
  }
);

export const uploadResume = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new BadRequestError("No file uploaded");
    }

    const result = await uploadService.uploadResume(
      req.file.buffer,
      req.file.mimetype
    );

    // Update user's resume URL
    await authService.updateUserResume(req.user!.id, result.url);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Resume uploaded successfully",
      data: {
        resumeUrl: result.url,
      },
    });
  }
);
