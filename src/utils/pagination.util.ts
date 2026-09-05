export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy: string;
  order: "ASC" | "DESC";
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function getSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export function buildPaginationMeta<T>(result: PaginatedResult<T>) {
  return {
    currentPage: result.page,
    totalPages: result.totalPages,
    total: result.total,
    limit: result.limit,
    hasNextPage: result.page < result.totalPages,
    hasPrevPage: result.page > 1,
  };
}
