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
    const {
      page = "1",
      limit = "12",
      sortBy = "createdAt",
      order = "desc",
    } = req.query as {
      page?: string;
      limit?: string;
      sortBy?: string;
      order?: string;
    };

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      order: order.toUpperCase() as "ASC" | "DESC",
    };
    const result = await savedJobService.getMySavedJobs(
      req.user!.id,
      pagination
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.savedJobs,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalSavedJobs: result.total,
        limit: pagination.limit,
        hasNextPage: result.page < result.totalPages,
        hasPrevPage: result.page > 1,
      },
    });
  }
);
