import { User } from "../entities/User.entity";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      // Kết quả sau khi Zod parse + transform (page/limit thành number, index thành number...)
      tokenPayload?: JwtPayload;
      validatedQuery?: Record<string, any>;
      validatedParams?: Record<string, any>;
    }
  }
}

/**
 * Request đã "biết" type cụ thể sau khi qua middleware validate().
 * Dùng làm generic cho asyncHandler<ValidatedRequest<...>> ở controller,
 * thay cho việc cast `as {...}` thủ công lặp lại ở từng nơi.
 *
 * TParams/TQuery nên lấy trực tiếp từ z.infer<typeof schema> trong validator
 * tương ứng, để type luôn bám theo schema thật (sửa schema -> type tự cập nhật).
 */

export type ValidatedRequest<
  TParams = Record<string, any>,
  TQuery = Record<string, any>,
  TBody = any,
> = Request<any, any, TBody, any> & {
  validatedParams: TParams;
  validatedQuery: TQuery;
};

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  jti?: string;   // chỉ có ở access token (thêm qua generateAccessToken)
  iat?: number;   // jwt tự thêm khi sign
  exp?: number;   // jwt tự thêm khi sign
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  order?: "asc" | "desc" | "ASC" | "DESC";
}

export interface JobFilterQuery extends PaginationQuery {
  keyword?: string;
  location?: string;
  category?: string | string[];
  type?: string | string[];
  level?: string;
  minSalary?: string;
  maxSalary?: string;
  userId?: string;
}
