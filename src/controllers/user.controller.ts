import { Response } from "express";
import { userService } from "../services/user.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HTTP_STATUS, HTTP_MESSAGE } from "../constants/httpStatus";
import { sendPaginated } from "../utils/http-response.util";

import {
  UpdateProfileBody,
  GetPublicProfileParams,
  SearchUsersQuery,
  AddExperienceBody,
  UpdateExperienceParams,
  UpdateExperienceBody,
  DeleteExperienceParams,
  AddProjectBody,
  UpdateProjectParams,
  UpdateProjectBody,
  DeleteProjectParams,
} from "../validators/user.validator";
import { ValidatedRequest } from "../types/express";

export const updateProfile = asyncHandler<
  ValidatedRequest<{}, {}, UpdateProfileBody>
>(async (req, res: Response): Promise<void> => {
  const user = await userService.updateProfile(req.user!.id, req.body);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: HTTP_MESSAGE.UPDATED,
    data: user,
  });
});

export const deleteResume = asyncHandler(
  async (req, res: Response): Promise<void> => {
    await userService.deleteResume(req.user!.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: HTTP_MESSAGE.DELETED,
    });
  }
);

export const getPublicProfile = asyncHandler<
  ValidatedRequest<GetPublicProfileParams, {}, {}>
>(async (req, res: Response): Promise<void> => {
  const { id } = req.validatedParams;
  const viewer = req.user ? {id: req.user.id, role: req.user.role} : undefined;
  const user = await userService.getPublicProfile(id, viewer);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: user,
  });
});

export const getMyProfile = asyncHandler(
  async (req, res: Response): Promise<void> => {
    const user = await userService.getMyProfile(req.user!.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: user,
    });
  }
);

export const searchUsers = asyncHandler<
  ValidatedRequest<{}, SearchUsersQuery, {}>
>(async (req, res: Response): Promise<void> => {
  const { q, page, limit, skills } = req.validatedQuery;

  const result = await userService.searchUsers(
    q,
    req.user!.id,
    page,
    limit,
    skills
  );

  sendPaginated(res, result);
});

export const addExperience = asyncHandler<
  ValidatedRequest<{}, {}, AddExperienceBody>
>(async (req, res: Response): Promise<void> => {
  const user = await userService.addExperience(req.user!.id, req.body);

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: "Experience added successfully",
    data: user.experience,
  });
});

export const updateExperience = asyncHandler<
  ValidatedRequest<UpdateExperienceParams, {}, UpdateExperienceBody>
>(async (req, res: Response): Promise<void> => {
  const { id } = req.validatedParams;
  const user = await userService.updateExperience(req.user!.id, id, req.body);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Experience updated successfully",
    data: user.experience,
  });
});

export const deleteExperience = asyncHandler<
  ValidatedRequest<DeleteExperienceParams, {}, {}>
>(async (req, res: Response): Promise<void> => {
  const { id } = req.validatedParams;
  const user = await userService.deleteExperience(req.user!.id, id);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Experience deleted successfully",
    data: user.experience,
  });
});

export const addProject = asyncHandler<
  ValidatedRequest<{}, {}, AddProjectBody>
>(async (req, res: Response): Promise<void> => {
  const user = await userService.addProject(req.user!.id, req.body);

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: "Project added successfully",
    data: user.projects,
  });
});

export const updateProject = asyncHandler<
  ValidatedRequest<UpdateProjectParams, {}, UpdateProjectBody>
>(async (req, res: Response): Promise<void> => {
  const { id } = req.validatedParams;
  const user = await userService.updateProject(req.user!.id, id, req.body);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Project updated successfully",
    data: user.projects,
  });
});

export const deleteProject = asyncHandler<
  ValidatedRequest<DeleteProjectParams, {}, {}>
>(async (req, res: Response): Promise<void> => {
  const { id } = req.validatedParams;
  const user = await userService.deleteProject(req.user!.id, id);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Project deleted successfully",
    data: user.projects,
  });
});
