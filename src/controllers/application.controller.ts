import { Request, Response } from "express";
import { applicationService } from "../services/application.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ForbiddenError } from "../utils/errors";
import { UserRole } from "../entities/User.entity";
import { HTTP_STATUS, HTTP_MESSAGE } from "../constants/httpStatus";

export const applyToJob = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (req.user!.role !== UserRole.JOBSEEKER) {
      throw new ForbiddenError("Only job seekers can apply");
    }

    const application = await applicationService.applyToJob(
      req.params.jobId,
      req.user!.id,
      req.user!.resume || ""
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: HTTP_MESSAGE.CREATED,
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
      data: applications,
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
      data: applications,
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
      data: application,
    });
  }
);

export const updateStatus = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { status } = req.body;

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