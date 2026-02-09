import { Request, Response } from "express";
import { applicationService } from "../services/application.service";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, ForbiddenError } from "../utils/errors";
import { UserRole } from "../entities/User.entity";
import { HTTP_STATUS, HTTP_MESSAGE } from "../constants/httpStatus";
import { ApplicationStatus } from "../entities/Application.entity";

export const applyToJob = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (req.user!.role !== UserRole.JOBSEEKER) {
      throw new ForbiddenError("Only job seekers can apply");
    }

    if (!req.user!.resume) {
      throw new BadRequestError(
        "Please upload your resume before applying for jobs"
      );
    }

    const application = await applicationService.applyToJob(
      req.params.jobId,
      req.user!.id,
      req.user!.resume
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Application submitted successfully",
      data: application,
    });
  }
);

export const getMyApplications = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const applications = await applicationService.getMyApplications(
      req.user!.id
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Applications retrieved successfully",
      data: applications,
      meta: {
        total: applications.length,
      },
    });
  }
);

export const getApplicantsForJob = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (req.user!.role !== UserRole.EMPLOYER) {
      throw new ForbiddenError("Only employers can view applicants");
    }

    const applications = await applicationService.getApplicantsForJob(
      req.params.jobId,
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
  }
);

export const getApplicationById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const application = await applicationService.getApplicationById(
      req.params.id,
      req.user!.id
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Application retrieved successfully",
      data: application,
    });
  }
);

export const updateStatus = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { status } = req.body;

    const validStatuses = Object.values(ApplicationStatus);
    if (!validStatuses.includes(status)) {
      throw new BadRequestError(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      );
    }

    const result = await applicationService.updateApplicationStatus(
      req.params.id,
      req.user!.id,
      status
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: result.message,
      data: { status: result.status },
    });
  }
);

export const withdrawApplication = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (req.user!.role !== UserRole.JOBSEEKER) {
      throw new ForbiddenError("Only job seekers can withdraw applications");
    }

    const result = await applicationService.withdrawApplication(
      req.params.id,
      req.user!.id
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: result.message,
    });
  }
);


export const triggerAIAnalysis = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (req.user!.role !== UserRole.EMPLOYER) {
      throw new ForbiddenError("Only employers can trigger AI analysis");
    }

    const result = await applicationService.triggerAIAnalysis(
      req.params.id,
      req.user!.id
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: result.message,
      data: result.analysis,
    });
  }
);