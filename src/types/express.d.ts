import { User } from "../entities/User.entity";

declare global {
  namespace Express {
    interface Request {
      user?: User;
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
  minSalary?: string;
  maxSalary?: string;
  userId?: string;
}
