import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { HTTP_STATUS } from "../constants/httpStatus";
import { savedJobService } from "../services/savedJob.service";
import { buildPaginationMeta } from "../utils/pagination.util";
import { ValidatedRequest } from "../types/express";
import {
  GetMySavedJobsQuery,
  SavedJobParams,
  UnsaveJobParams,
} from "../validators/savedJob.validator";

export const saveJob = asyncHandler<
  ValidatedRequest<SavedJobParams, Record<string, never>, undefined>
>(async (req, res: Response): Promise<void> => {
  const savedJob = await savedJobService.saveJob(
    req.validatedParams.jobId,
    req.user!.id
  );

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: "Job saved successfully",
    data: savedJob,
  });
});

export const unsaveJob = asyncHandler<
  ValidatedRequest<UnsaveJobParams, Record<string, never>, undefined>
>(async (req, res: Response): Promise<void> => {
  await savedJobService.unsaveJob(req.validatedParams.jobId, req.user!.id);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Job removed from saved list",
  });
});

export const getMySavedJobs = asyncHandler<
  ValidatedRequest<Record<string, never>, GetMySavedJobsQuery, undefined>
>(async (req, res: Response): Promise<void> => {
  const result = await savedJobService.getMySavedJobs(
    req.user!.id,
    req.validatedQuery
  );

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: result.items,
    pagination: buildPaginationMeta(result),
  });
});
