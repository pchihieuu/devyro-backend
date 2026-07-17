import { User } from "../entities/User.entity";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      // Kết quả sau khi Zod parse + transform (page/limit thành number, index thành number...)
      validatedQuery?: Record<string, any>;
      validatedParams?: Record<string, any>;
    }
  }
}

export interface JwtPayload {
  id: string;
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