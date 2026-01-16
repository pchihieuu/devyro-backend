import { Request, Response } from "express";
import { analyticsService } from "../services/analytics.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ForbiddenError } from "../utils/errors";
import { UserRole } from "../entities/User.entity";
import { HTTP_STATUS } from "../constants/httpStatus";

export const getEmployerAnalytics = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (req.user!.role !== UserRole.EMPLOYER) {
      throw new ForbiddenError("Access denied");
    }

    const analytics = await analyticsService.getEmployerAnalytics(
      req.user!.id
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: analytics,
    });
  }
);