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
      data: user,
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

export const getMyProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = await userService.getMyProfile(req.user!.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: user,
    });
  }
);

export const searchUsers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!query || query.trim() === "") {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Search query is required",
      });
      return;
    }

    const result = await userService.searchUsers(
      query,
      req.user!.id,
      page,
      limit
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
    });
  }
);

export const addExperience = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = await userService.addExperience(req.user!.id, req.body);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Experience added successfully",
      data: user.experience,
    });
  }
);

export const updateExperience = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const index = parseInt(req.params.index);
    const user = await userService.updateExperience(
      req.user!.id,
      index,
      req.body
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Experience updated successfully",
      data: user.experience,
    });
  }
);

export const deleteExperience = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const index = parseInt(req.params.index);
    const user = await userService.deleteExperience(req.user!.id, index);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Experience deleted successfully",
      data: user.experience,
    });
  }
);

export const addProject = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = await userService.addProject(req.user!.id, req.body);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Project added successfully",
      data: user.projects,
    });
  }
);

export const updateProject = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const index = parseInt(req.params.index);
    const user = await userService.updateProject(req.user!.id, index, req.body);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Project updated successfully",
      data: user.projects,
    });
  }
);

export const deleteProject = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const index = parseInt(req.params.index);
    const user = await userService.deleteProject(req.user!.id, index);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Project deleted successfully",
      data: user.projects,
    });
  }
);