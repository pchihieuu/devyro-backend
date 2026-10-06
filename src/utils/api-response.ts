import { Response } from "express";
import { HTTP_STATUS } from "../constants/httpStatus";
import { FieldError } from "./errors";
import {
  PaginatedResult,
  buildPaginationMeta,
} from "./pagination.util";

/**
 * Shape response thống nhất cho toàn bộ API.
 *
 * Thành công: { success: true, message?, data?, pagination?, meta?, ...extra }
 * Thất bại:   { success: false, message, errors, code?, requestId?, ...extra }
 *
 * Controller/middleware KHÔNG tự `res.status(...).json({ success, ... })` nữa —
 * luôn đi qua ApiResponse để đổi format (thêm requestId, envelope version...)
 * chỉ cần sửa 1 chỗ. Các key top-level cũ mà FE đang dùng (vd `counts`,
 * `retryAfter`) đi qua `extra` để giữ nguyên wire format.
 */

export type PaginationMeta = ReturnType<typeof buildPaginationMeta>;

export interface ApiSuccessBody<T = unknown> {
  success: true;
  message?: string;
  data?: T;
  pagination?: PaginationMeta;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  errors?: FieldError[];
  code?: string;
  requestId?: string;
}

interface SuccessOptions<T> {
  status?: number;
  message?: string;
  data?: T;
  pagination?: PaginationMeta;
  meta?: Record<string, unknown>;
  /** Key top-level bổ sung, chỉ dùng để tương thích ngược với FE cũ. */
  extra?: Record<string, unknown>;
}

interface ErrorOptions {
  errors?: FieldError[];
  code?: string;
  requestId?: string;
  extra?: Record<string, unknown>;
}

export class ApiResponse {
  /** Primitive cấp thấp — các helper bên dưới đều gọi vào đây. */
  static success<T>(
    res: Response,
    { status = HTTP_STATUS.OK, message, data, pagination, meta, extra }: SuccessOptions<T> = {}
  ): void {
    const body: ApiSuccessBody<T> & Record<string, unknown> = {
      success: true,
      ...(message !== undefined && { message }),
      ...(data !== undefined && { data }),
      ...(pagination !== undefined && { pagination }),
      ...(meta !== undefined && { meta }),
      ...extra,
    };
    res.status(status).json(body);
  }

  /** 200 + data (+ message). */
  static ok<T>(
    res: Response,
    data?: T,
    message?: string,
    extra?: Pick<SuccessOptions<T>, "meta" | "extra">
  ): void {
    ApiResponse.success(res, { data, message, ...extra });
  }

  /** 201 + data (+ message). */
  static created<T>(res: Response, data?: T, message?: string): void {
    ApiResponse.success(res, { status: HTTP_STATUS.CREATED, data, message });
  }

  /** 200 chỉ có message (delete, mark-as-read, logout...). */
  static message(res: Response, message: string): void {
    ApiResponse.success(res, { message });
  }

  /** List có phân trang — nhận thẳng PaginatedResult từ buildPaginatedResult. */
  static paginated<T>(
    res: Response,
    result: PaginatedResult<T>,
    opts: { message?: string; meta?: Record<string, unknown> } = {}
  ): void {
    ApiResponse.success(res, {
      data: result.items,
      pagination: buildPaginationMeta(result),
      ...opts,
    });
  }

  static error(
    res: Response,
    status: number,
    message: string,
    { errors, code, requestId, extra }: ErrorOptions = {}
  ): void {
    const body: ApiErrorBody & Record<string, unknown> = {
      success: false,
      message,
      errors: errors ?? [{ field: null, message }],
      ...(code !== undefined && { code }),
      ...(requestId !== undefined && { requestId }),
      ...extra,
    };
    res.status(status).json(body);
  }
}
