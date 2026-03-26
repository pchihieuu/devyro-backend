import { Request, Response, NextFunction } from "express";
import { UserRole } from "../entities/User.entity";
import { success } from "zod";

export const adminOnly = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== UserRole.ADMIN) {
    res.status(403).json({
      success: false,
      message: "Access denied. Admin only.",
    });
    return;
  }
  next();
};
