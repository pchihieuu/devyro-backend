import { Response } from "express";
import { jobService } from "../services/job.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ForbiddenError, NotFoundError } from "../utils/errors";
import { UserRole } from "../entities/User.entity";
import { HTTP_STATUS, HTTP_MESSAGE } from "../constants/httpStatus";
import { buildPaginationMeta } from "../utils/pagination.util";
import { ValidatedRequest } from "../types/express";
import {
  JobIdParams,
  GetJobByIdParams,
  UpdateJobParams,
  UpdateJobBody,
  GetJobsQuery,
  EmployerJobsQuery,
} from "../validators/job.validator";
import { PaginationOptions } from "../utils/pagination.util";

export const createJob = asyncHandler(
  async (req: ValidatedRequest, res: Response): Promise<void> => {
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

export const getJobs = asyncHandler<
  ValidatedRequest<Record<string, never>, GetJobsQuery>
>(async (req, res): Promise<void> => {
  const {
    keyword,
    location,
    category,
    type,
    level,
    minSalary,
    maxSalary,
    skills,
    page,
    limit,
    sortBy,
    order,
  } = req.validatedQuery;

  const filters = {
    keyword,
    location,
    category,
    type,
    level,
    minSalary,
    maxSalary,
    skills,
    userId: req.user?.id,
  };
  const pagination: PaginationOptions = { page, limit, sortBy, order };

  const result = await jobService.getJobs(filters, pagination);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: result.items,
    pagination: { ...buildPaginationMeta(result), limit: pagination.limit },
  });
});

export const getJobsEmployer = asyncHandler<
  ValidatedRequest<Record<string, never>, EmployerJobsQuery>
>(async (req, res): Promise<void> => {
  if (req.user!.role !== UserRole.EMPLOYER) {
    throw new ForbiddenError("Access denied");
  }

  const { page, limit, sortBy, order } = req.validatedQuery;

  const result = await jobService.getJobsEmployer(req.user!.id, {
    page,
    limit,
    sortBy,
    order,
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: result.items,
    pagination: { ...buildPaginationMeta(result), limit },
  });
});

export const getJobById = asyncHandler<ValidatedRequest<GetJobByIdParams>>(
  async (req, res): Promise<void> => {
    const { id } = req.validatedParams;
    const userId = req.user?.id;

    const job = await jobService.getJobById(id, userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: job,
    });
  }
);

export const updateJob = asyncHandler<
  ValidatedRequest<UpdateJobParams, Record<string, never>, UpdateJobBody>
>(async (req, res): Promise<void> => {
  const { id } = req.validatedParams;
  const job = await jobService.updateJob(id, req.user!.id, req.body);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: HTTP_MESSAGE.UPDATED,
    data: job,
  });
});

export const deleteJob = asyncHandler<ValidatedRequest<JobIdParams>>(
  async (req, res): Promise<void> => {
    const { id } = req.validatedParams;
    await jobService.deleteJob(id, req.user!.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: HTTP_MESSAGE.DELETED,
    });
  }
);

export const toggleCloseJob = asyncHandler<ValidatedRequest<JobIdParams>>(
  async (req, res): Promise<void> => {
    const { id } = req.validatedParams;
    const result = await jobService.toggleJobStatus(id, req.user!.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: result.message,
      data: { isClosed: result.isClosed },
    });
  }
);
