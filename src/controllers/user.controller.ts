import { Request, Response } from "express";
import { userService } from "../services/user.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HTTP_STATUS, HTTP_MESSAGE } from "../constants/httpStatus";

export const updateProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = await userService.updateProfile(req.user!.id, req.body);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: HTTP_MESSAGE.UPDATED,
      data: {
        _id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        resume: user.resume || "",
        companyName: user.companyName || "",
        companyDescription: user.companyDescription || "",
        companyLogo: user.companyLogo || "",
        companySize: user.companySize || "",
        companyIndustry: user.companyIndustry || "",
        companyAddress: user.companyAddress || "",
        companyWebsite: user.companyWebsite || "",
      },
    });
  }
);

export const deleteResume = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await userService.deleteResume(req.user!.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: HTTP_MESSAGE.DELETED,
    });
  }
);

export const getPublicProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = await userService.getPublicProfile(req.params.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: user,
    });
  }
);
