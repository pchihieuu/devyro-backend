import { Request, Response, NextFunction } from "express";
import { AppError, FieldError } from "../utils/errors";
import { HTTP_STATUS } from "../constants/httpStatus";
import { logger } from "../utils/logger";
import { ApiResponse } from "../utils/api-response";
import { captureError } from "../observability/sentry";
import { pgErrorCode } from "../utils/db-error.util";

interface ResolvedError {
  statusCode: number;
  message: string;
  isOperational: boolean;
  errors: FieldError[];
  code?: string;
}

const single = (message: string): FieldError[] => [{ field: null, message }];

/**
 * Lỗi DB không còn bị gộp hết thành 400. Trước đây mọi QueryFailedError (kể cả
 * statement timeout, deadlock, mất kết nối) trả 400 "A database error
 * occurred" → client/monitor hiểu là lỗi của người dùng. Giờ phân biệt lỗi do
 * dữ liệu client (4xx) với lỗi hạ tầng (5xx, có log + Sentry).
 */
const resolveDatabaseError = (err: Error): ResolvedError => {
  const code = pgErrorCode(err);
  const build = (
    statusCode: number,
    message: string,
    isOperational: boolean
  ): ResolvedError => ({
    statusCode,
    message,
    isOperational,
    errors: single(message),
  });

  switch (code) {
    case "23505": // unique_violation
      return build(HTTP_STATUS.CONFLICT, "Resource already exists", true);
    case "23503": // foreign_key_violation
      return build(
        HTTP_STATUS.CONFLICT,
        "Operation conflicts with related data",
        true
      );
    case "22P02": // invalid_text_representation (vd uuid sai định dạng)
    case "23502": // not_null_violation
    case "22001": // string_data_right_truncation
      return build(HTTP_STATUS.BAD_REQUEST, "Invalid data provided", true);
    case "57014": // query_canceled (statement_timeout)
      return build(
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        "The request took too long. Please try again.",
        false
      );
    default:
      return build(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "A database error occurred. Please try again.",
        false
      );
  }
};

const resolveError = (err: Error | AppError): ResolvedError => {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      message: err.message,
      isOperational: err.isOperational,
      errors: err.errors,
      code: (err as { code?: string }).code,
    };
  }
  if (err.name === "QueryFailedError") return resolveDatabaseError(err);
  if (err.name === "EntityNotFoundError") {
    return {
      statusCode: HTTP_STATUS.NOT_FOUND,
      message: "Resource not found",
      isOperational: true,
      errors: single("Resource not found"),
    };
  }
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    const message = "Invalid or expired authentication token.";
    return {
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      message,
      isOperational: true,
      errors: single(message),
    };
  }
  if (err.name === "MulterError") {
    return {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      message: err.message,
      isOperational: true,
      errors: single(err.message),
    };
  }
  if (err.message?.startsWith("CORS blocked:")) {
    const message = "Request blocked by CORS policy.";
    return {
      statusCode: HTTP_STATUS.FORBIDDEN,
      message,
      isOperational: true,
      errors: single(message),
    };
  }
  // body-parser: JSON sai cú pháp / payload quá lớn → lỗi của client, không phải 500.
  const httpErr = err as { status?: number; type?: string };
  if (
    httpErr.type === "entity.parse.failed" ||
    httpErr.type === "entity.too.large"
  ) {
    const message =
      httpErr.type === "entity.too.large"
        ? "Request body too large"
        : "Malformed JSON body";
    return {
      statusCode: httpErr.status ?? HTTP_STATUS.BAD_REQUEST,
      message,
      isOperational: true,
      errors: single(message),
    };
  }

  const message = "Internal server error";
  return {
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message,
    isOperational: false,
    errors: single(message),
  };
};

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const { statusCode, message, isOperational, errors, code } =
    resolveError(err);

  if (!isOperational || statusCode >= 500) {
    logger.error("Error:", {
      requestId: req.id,
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id,
    });
    captureError(err, {
      requestId: req.id,
      userId: req.user?.id,
      method: req.method,
      url: req.originalUrl,
      statusCode,
    });
  } else {
    logger.warn("Operational Error:", {
      requestId: req.id,
      message: err.message,
      url: req.url,
      method: req.method,
      statusCode,
    });
  }

  // NEVER send stack trace or raw error object in production. In development
  // attach stack only — not the full error object which can contain DB
  // credentials, internal paths, ORM query details, etc.
  const isDev = process.env.NODE_ENV === "development";

  ApiResponse.error(res, statusCode, message, {
    errors,
    code,
    requestId: req.id,
    extra: isDev ? { stack: err.stack } : undefined,
  });
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  ApiResponse.error(
    res,
    HTTP_STATUS.NOT_FOUND,
    `Route ${req.originalUrl} not found`,
    { requestId: req.id }
  );
};
