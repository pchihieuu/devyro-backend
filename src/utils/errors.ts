import { HTTP_STATUS } from "../constants/httpStatus";

export interface FieldError {
  field: string | null;
  message: string;
}
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  errors: FieldError[];

  constructor(message: string, statusCode: number, errors?: FieldError[]) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errors = errors ?? [{ field: null, message }];

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad Request", errors?: FieldError[]) {
    super(message, HTTP_STATUS.BAD_REQUEST, errors);
  }
}

export class UnauthorizedError extends AppError {
  code?: string;
  constructor(message: string, code?: string) {
    super(message, HTTP_STATUS.UNAUTHORIZED);
    this.code = code;
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, HTTP_STATUS.FORBIDDEN);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, HTTP_STATUS.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(message, HTTP_STATUS.CONFLICT);
  }
}

export class ValidationError extends AppError {
  constructor(errors: FieldError[], message: string = "Validation failed") {
    super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, errors);
  }
}
