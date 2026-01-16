import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HTTP_STATUS, HTTP_MESSAGE } from "../constants/httpStatus";

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
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "No file uploaded",
      });
      return;
    }

    const result = await authService.uploadImage(
      req.file.buffer,
      req.file.mimetype
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Image uploaded successfully",
      data: result,
    });
  }
);

export const uploadResume = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const result = await authService.uploadResume(
      req.user!.id,
      req.file!.buffer,
      req.file!.mimetype
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Resume uploaded successfully",
      data: result,
    });
  }
);
