import { markAdminOnly } from "../openapi/markers";
import { Request, Response, NextFunction } from "express";
import { UserRole } from "../entities/User.entity";
import { HTTP_STATUS } from "../constants/httpStatus";
import { ApiResponse } from "../utils/api-response";

export const adminOnly = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== UserRole.ADMIN) {
    ApiResponse.error(
      res,
      HTTP_STATUS.FORBIDDEN,
      "Access denied. Admin only.",
      { requestId: req.id }
    );
    return;
  }
  next();
};

markAdminOnly(adminOnly);
