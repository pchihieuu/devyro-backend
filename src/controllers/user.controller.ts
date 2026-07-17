import { Request, Response } from "express";
import { userService } from "../services/user.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HTTP_STATUS, HTTP_MESSAGE } from "../constants/httpStatus";
import { sendPaginated } from "../utils/http-response.util";

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
    const { q, page, limit } = req.validatedQuery as {
      q: string;
      page: number;
      limit: number;
    };

    const result = await userService.searchUsers(q, req.user!.id, page, limit);

    // Dùng chung helper -> mọi API phân trang trong hệ thống (job, company, user...)
    // trả về đúng 1 format JSON, không cần nhớ gọi buildPaginationMeta ở từng nơi.
    sendPaginated(res, result);
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
    const { id } = req.validatedParams as { id: string };
    const user = await userService.updateExperience(
      req.user!.id,
      id,
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
    const { id } = req.validatedParams as { id: string };
    const user = await userService.deleteExperience(req.user!.id, id);

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
    const { id } = req.validatedParams as { id: string };
    const user = await userService.updateProject(req.user!.id, id, req.body);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Project updated successfully",
      data: user.projects,
    });
  }
);

export const deleteProject = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const user = await userService.deleteProject(req.user!.id, id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Project deleted successfully",
      data: user.projects,
    });
  }
);
