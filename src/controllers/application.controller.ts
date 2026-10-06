import { Response } from "express";
import { applicationService } from "../services/application.service";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, ForbiddenError } from "../utils/errors";
import { UserRole } from "../entities/User.entity";
import { HTTP_STATUS } from "../constants/httpStatus";
import { ValidatedRequest } from "../types/express";
import { ApiResponse } from "../utils/api-response";
import {
  ApplyToJobParams,
  GetApplicantsParams,
  GetApplicationByIdParams,
  GetMyApplicationsQuery,
  UpdateApplicationStatusBody,
  UpdateApplicationStatusParams,
} from "../validators/application.validator";

/** Lỗi từ Gemini SDK có thể mang `statusCode` — thu hẹp `unknown` thay vì `any`. */
const describeAiError = (
  error: unknown
): { statusCode: number | undefined; message: string } => {
  if (error instanceof Error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return {
      statusCode: typeof statusCode === "number" ? statusCode : undefined,
      message: error.message,
    };
  }
  return { statusCode: undefined, message: String(error) };
};

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

  ApiResponse.created(res, application, "Application submitted successfully");
});

export const getMyApplications = asyncHandler<
  ValidatedRequest<Record<string, never>, GetMyApplicationsQuery, undefined>
>(async (req, res: Response): Promise<void> => {
  const result = await applicationService.getMyApplications(
    req.user!.id,
    req.validatedQuery
  );

  ApiResponse.paginated(res, result, {
    message: "Applications retrieved successfully",
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

  ApiResponse.ok(res, applications, "Applicants retrieved successfully", {
    meta: { total: applications.length },
  });
});

export const getApplicationById = asyncHandler<
  ValidatedRequest<GetApplicationByIdParams, Record<string, never>, undefined>
>(async (req, res: Response): Promise<void> => {
  const application = await applicationService.getApplicationById(
    req.validatedParams.id,
    req.user!.id
  );

  ApiResponse.ok(res, application, "Application retrieved successfully");
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

  ApiResponse.ok(res, { status: result.status }, result.message);
});

export const withdrawApplication = asyncHandler<
  ValidatedRequest<GetApplicationByIdParams, Record<string, never>, undefined>
>(async (req, res: Response): Promise<void> => {
  if (req.user!.role !== UserRole.JOBSEEKER) {
    throw new ForbiddenError("Only job seekers can withdraw applications");
  }

  const result = await applicationService.withdrawApplication(
    req.validatedParams.id,
    req.user!.id
  );

  ApiResponse.message(res, result.message);
});

export const triggerAIAnalysis = asyncHandler<
  ValidatedRequest<GetApplicationByIdParams, Record<string, never>, undefined>
>(async (req, res: Response): Promise<void> => {
  if (req.user!.role !== UserRole.EMPLOYER) {
    throw new ForbiddenError("Only employers can trigger AI analysis");
  }

  try {
    const result = await applicationService.triggerAIAnalysis(
      req.validatedParams.id,
      req.user!.id
    );

    ApiResponse.ok(res, result.analysis, result.message);
  } catch (error: unknown) {
    const { statusCode, message } = describeAiError(error);
    // Distinguish quota errors from other errors
    if (statusCode === 429 || message.includes("quota")) {
      ApiResponse.error(
        res,
        HTTP_STATUS.TOO_MANY_REQUESTS,
        "AI service quota exceeded. Please try again later.",
        { extra: { retryAfter: 30 } }
      );
      return;
    }
    if (statusCode === 503 || message.includes("overloaded")) {
      ApiResponse.error(
        res,
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        "AI service is currently overloaded. Please try again later.",
        { extra: { retryAfter: 60 } }
      );
      return;
    }
    throw error; // Let asyncHandler handle other errors.
  }
});
