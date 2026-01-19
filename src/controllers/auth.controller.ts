import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { uploadService } from "../services/upload.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HTTP_STATUS, HTTP_MESSAGE } from "../constants/httpStatus";
import { BadRequestError } from "../utils/errors";

export const register = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = await authService.register(req.body);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "User registered successfully",
      data: user,
    });
  }
);

export const login = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = await authService.login(req.body);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Login successful",
      data: user,
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