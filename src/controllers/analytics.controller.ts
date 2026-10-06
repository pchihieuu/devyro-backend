import { Request, Response } from "express";
import { analyticsService } from "../services/analytics.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/api-response";

export const getEmployerAnalytics = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const analytics = await analyticsService.getEmployerAnalytics(
      req.user!.id,
      req.user!.role
    );

    // `counts` giữ ở top-level vì FE cũ đọc trực tiếp res.counts.
    ApiResponse.ok(res, analytics, undefined, {
      extra: { counts: analytics.counts },
    });
  }
);