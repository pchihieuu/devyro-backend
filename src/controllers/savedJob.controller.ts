import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { HTTP_STATUS, HTTP_MESSAGE } from "../constants/httpStatus";
import { savedJobService } from "../services/savedJob.service";

export const saveJob = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const savedJob = await savedJobService.saveJob(
      req.params.jobId,
      req.user!.id
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Job saved successfully",
      data: savedJob,
    });
  }
);

export const unsaveJob = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await savedJobService.unsaveJob(req.params.jobId, req.user!.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Job removed from saved list",
    });
  }
);

export const getMySavedJobs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const savedJobs = await savedJobService.getMySavedJobs(req.user!.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: savedJobs,
    });
  }
);
