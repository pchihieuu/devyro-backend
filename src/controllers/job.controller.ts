import { Request, Response } from "express";
import { jobService } from "../services/job.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ForbiddenError, NotFoundError } from "../utils/errors";
import { UserRole } from "../entities/User.entity";
import { HTTP_STATUS, HTTP_MESSAGE } from "../constants/httpStatus";
import { JobFilterQuery } from "../types/express";

export const createJob = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (req.user!.role !== UserRole.EMPLOYER) {
      throw new ForbiddenError("Only employers can post jobs");
    }

    try {
      const job = await jobService.createJob(req.user!.id, req.body);

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: HTTP_MESSAGE.CREATED,
        data: job,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Please create a company profile before posting jobs",
        });
        return;
      }
      throw error;
    }
  }
);

export const getJobs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      keyword,
      location,
      category,
      type,
      level,
      minSalary,
      maxSalary,
      userId,
      page = "1",
      limit = "12",
      sortBy = "createdAt",
      order = "desc",
    } = req.query as JobFilterQuery;

    const filters = {
      keyword,
      location,
      category,
      type,
      level, 
      minSalary,
      maxSalary,
      userId,
    };

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      order: order.toUpperCase() as "ASC" | "DESC",
    };

    const result = await jobService.getJobs(filters, pagination);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.jobs,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalJobs: result.total,
        limit: pagination.limit,
        hasNextPage: result.page < result.totalPages,
        hasPrevPage: result.page > 1,
      },
    });
  }
);

export const getJobsEmployer = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (req.user!.role !== UserRole.EMPLOYER) {
      throw new ForbiddenError("Access denied");
    }

    const {
      page = "1",
      limit = "6",
      sortBy = "createdAt",
      order = "desc",
    } = req.query;
    const orderRaw = typeof order === "string" ? order : "desc";

    const result = await jobService.getJobsEmployer(req.user!.id, {
      page: Number(page),
      limit: Number(limit),
      sortBy: sortBy as string,
      order: orderRaw.toUpperCase() as "ASC" | "DESC",
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.jobs,
      pagination: result.pagination,
    });
  }
);

export const getJobById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.query;
    const job = await jobService.getJobById(
      req.params.id,
      userId as string | undefined
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: job,
    });
  }
);

export const updateJob = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const job = await jobService.updateJob(
      req.params.id,
      req.user!.id,
      req.body
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: HTTP_MESSAGE.UPDATED,
      data: job,
    });
  }
);

export const deleteJob = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await jobService.deleteJob(req.params.id, req.user!.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: HTTP_MESSAGE.DELETED,
    });
  }
);

export const toggleCloseJob = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const result = await jobService.toggleJobStatus(
      req.params.id,
      req.user!.id
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: result.message,
      data: { isClosed: result.isClosed },
    });
  }
);