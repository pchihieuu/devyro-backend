import { Response } from "express";
import { applicationService } from "../services/application.service";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, ForbiddenError } from "../utils/errors";
import { UserRole } from "../entities/User.entity";
import { HTTP_STATUS } from "../constants/httpStatus";
import { ValidatedRequest } from "../types/express";
import {
  ApplyToJobParams,
  GetApplicantsParams,
  GetApplicationByIdParams,
  GetMyApplicationsQuery,
  UpdateApplicationStatusBody,
  UpdateApplicationStatusParams,
} from "../validators/application.validator";

export const applyToJob = asyncHandler<
  ValidatedRequest<ApplyToJobParams, Record<string, never>, undefined>
>(async (req, res: Response): Promise<void> => {
  if (req.user!.role !== UserRole.JOBSEEKER) {
    throw new ForbiddenError("Only job seekers can apply");
  }

  if (!req.user!.resume) {
    throw new BadRequestError(
      "Please upload your resume before applying for jobs"
    );
  }

  const application = await applicationService.applyToJob(
    req.validatedParams.jobId,
    req.user!.id,
    req.user!.resume
  );

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: "Application submitted successfully",
    data: application,
  });
});

export const getMyApplications = asyncHandler<
  ValidatedRequest<Record<string, never>, GetMyApplicationsQuery, undefined>
>(async (req, res: Response): Promise<void> => {
  const result = await applicationService.getMyApplications(
    req.user!.id,
    req.validatedQuery
  );

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Applications retrieved successfully",
    data: result.applications,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      total: result.total,
      limit: req.validatedQuery.limit,
      hasNextPage: result.page < result.totalPages,
      hasPrevPage: result.page > 1,
    },
  });
});

export const getApplicantsForJob = asyncHandler<
  ValidatedRequest<GetApplicantsParams, Record<string, never>, undefined>
>(async (req, res: Response): Promise<void> => {
  if (req.user!.role !== UserRole.EMPLOYER) {
    throw new ForbiddenError("Only employers can view applicants");
  }

  const applications = await applicationService.getApplicantsForJob(
    req.validatedParams.jobId,
    req.user!.id
  );

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Applicants retrieved successfully",
    data: applications,
    meta: {
      total: applications.length,
    },
  });
});

export const getApplicationById = asyncHandler<
  ValidatedRequest<GetApplicationByIdParams, Record<string, never>, undefined>
>(async (req, res: Response): Promise<void> => {
  const application = await applicationService.getApplicationById(
    req.validatedParams.id,
    req.user!.id
  );

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Application retrieved successfully",
    data: application,
  });
});

export const updateStatus = asyncHandler<
  ValidatedRequest<
    UpdateApplicationStatusParams,
    Record<string, never>,
    UpdateApplicationStatusBody
  >
>(async (req, res: Response): Promise<void> => {
  const result = await applicationService.updateApplicationStatus(
    req.validatedParams.id,
    req.user!.id,
    req.body.status
  );

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: result.message,
    data: { status: result.status },
  });
});

export const withdrawApplication = asyncHandler<ValidatedRequest<GetApplicationByIdParams, Record<string, never>, undefined>>(
  async (req, res: Response): Promise<void> => {
    if (req.user!.role !== UserRole.JOBSEEKER) {
      throw new ForbiddenError("Only job seekers can withdraw applications");
    }

    const result = await applicationService.withdrawApplication(
      req.validatedParams.id,
      req.user!.id
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: result.message,
    });
  }
);

export const triggerAIAnalysis = asyncHandler<ValidatedRequest<GetApplicationByIdParams, Record<string, never>, undefined>>(
  async (req, res: Response): Promise<void> => {
    if (req.user!.role !== UserRole.EMPLOYER) {
      throw new ForbiddenError("Only employers can trigger AI analysis");
    }

    try {
      const result = await applicationService.triggerAIAnalysis(
        req.validatedParams.id,
        req.user!.id
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
        data: result.analysis,
      });
    } catch (error: any) {
      const statusCode = error.statusCode;
      // Distinguish quota errors from other errors
      if (statusCode === 429 || error.message?.includes("quota")) {
        res.status(429).json({
          success: false,
          message: "AI service quota exceeded. Please try again later.",
          retryAfter: 30,
        });
        return;
      }
      if (statusCode === 503 || error.message?.includes("overloaded")) {
        res.status(503).json({
          success: false,
          message:
            "AI service is currently overloaded. Please try again later.",
          retryAfter: 60,
        });
        return;
      }
      throw error; // Let asyncHandler handle other errors.
    }
  }
);
