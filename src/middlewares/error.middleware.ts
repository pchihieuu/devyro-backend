import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";
import { HTTP_STATUS } from "../constants/httpStatus";
import { logger } from "../utils/logger";

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message = "Internal server error";
  let isOperational = false;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  } else if (
    err.name === "QueryFailedError" ||
    err.name === "EntityNotFoundError"
  ) {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = "A database error occurred. Please try again.";
    isOperational = false;
  } else if (
    err.name === "JsonWebTokenError" ||
    err.name === "TokenExpiredError"
  ) {
    statusCode = HTTP_STATUS.UNAUTHORIZED ?? 401;
    message = "Invalid or expired authentication token.";
    isOperational = true;
  } else if (err.name === "MulterError") {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = err.message;
    isOperational = true;
  } else if (err.message?.startsWith("CORS blocked:")) {
    statusCode = 403;
    message = "Request blocked by CORS policy.";
    isOperational = true;
  }

  if (!isOperational || statusCode >= 500) {
    logger.error("Error:", {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userId: (req as any).user?.id,
    });
  } else {
    logger.warn("Operational Error:", {
      message: err.message,
      url: req.url,
      method: req.method,
      statusCode,
    });
  }

  // ── Response ─────────────────────────────────────────────────────────────
  // NEVER send stack trace or raw error object in production.
  // In development, attach stack only — not the full error object which can
  // contain DB credentials, internal paths, ORM query details, etc.
  const isDev = process.env.NODE_ENV === "development";

  res.status(statusCode).json({
    success: false,
    message,
    ...(isDev && { stack: err.stack }),
  });
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};
