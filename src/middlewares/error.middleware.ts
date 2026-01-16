import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";
import { HTTP_STATUS } from "../constants/httpStatus";
import { logger } from "../utils/logger";

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message = "Internal server error";
  let isOperational = false;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }

  // Log error
  if (!isOperational || statusCode >= 500) {
    logger.error("Error:", {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id,
    });
  } else {
    logger.warn("Operational Error:", {
      message: err.message,
      url: req.url,
      method: req.method,
      statusCode,
    });
  }

  // Send response
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
      error: err,
    }),
  });
};

// Handle 404 - Not Found
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};