import { Response } from "express";
import { userService } from "../services/user.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HTTP_MESSAGE } from "../constants/httpStatus";
import { ApiResponse } from "../utils/api-response";

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

  ApiResponse.ok(res, user, HTTP_MESSAGE.UPDATED);
});

export const deleteResume = asyncHandler(
  async (req, res: Response): Promise<void> => {
    await userService.deleteResume(req.user!.id);

    ApiResponse.message(res, HTTP_MESSAGE.DELETED);
  }
);

export const getPublicProfile = asyncHandler<
  ValidatedRequest<GetPublicProfileParams, {}, {}>
>(async (req, res: Response): Promise<void> => {
  const { id } = req.validatedParams;
  const viewer = req.user ? {id: req.user.id, role: req.user.role} : undefined;
  const user = await userService.getPublicProfile(id, viewer);

  ApiResponse.ok(res, user);
});

export const getMyProfile = asyncHandler(
  async (req, res: Response): Promise<void> => {
    const user = await userService.getMyProfile(req.user!.id);

    ApiResponse.ok(res, user);
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

  ApiResponse.paginated(res, result);
});

export const addExperience = asyncHandler<
  ValidatedRequest<{}, {}, AddExperienceBody>
>(async (req, res: Response): Promise<void> => {
  const user = await userService.addExperience(req.user!.id, req.body);

  ApiResponse.created(res, user.experience, "Experience added successfully");
});

export const updateExperience = asyncHandler<
  ValidatedRequest<UpdateExperienceParams, {}, UpdateExperienceBody>
>(async (req, res: Response): Promise<void> => {
  const { id } = req.validatedParams;
  const user = await userService.updateExperience(req.user!.id, id, req.body);

  ApiResponse.ok(res, user.experience, "Experience updated successfully");
});

export const deleteExperience = asyncHandler<
  ValidatedRequest<DeleteExperienceParams, {}, {}>
>(async (req, res: Response): Promise<void> => {
  const { id } = req.validatedParams;
  const user = await userService.deleteExperience(req.user!.id, id);

  ApiResponse.ok(res, user.experience, "Experience deleted successfully");
});

export const addProject = asyncHandler<
  ValidatedRequest<{}, {}, AddProjectBody>
>(async (req, res: Response): Promise<void> => {
  const user = await userService.addProject(req.user!.id, req.body);

  ApiResponse.created(res, user.projects, "Project added successfully");
});

export const updateProject = asyncHandler<
  ValidatedRequest<UpdateProjectParams, {}, UpdateProjectBody>
>(async (req, res: Response): Promise<void> => {
  const { id } = req.validatedParams;
  const user = await userService.updateProject(req.user!.id, id, req.body);

  ApiResponse.ok(res, user.projects, "Project updated successfully");
});

export const deleteProject = asyncHandler<
  ValidatedRequest<DeleteProjectParams, {}, {}>
>(async (req, res: Response): Promise<void> => {
  const { id } = req.validatedParams;
  const user = await userService.deleteProject(req.user!.id, id);

  ApiResponse.ok(res, user.projects, "Project deleted successfully");
});
