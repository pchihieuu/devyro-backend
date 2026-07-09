import { z } from "zod";

export function createPaginationSchema<T extends [string, ...string[]]>(
  sortableFields: T,
  defaultSortBy: T[number] = sortableFields[0]
) {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(12),
    sortBy: z.enum(sortableFields).default(defaultSortBy),
    order: z
      .enum(["asc", "desc", "ASC", "DESC"])
      .transform((v) => v.toUpperCase() as "ASC" | "DESC")
      .default("DESC"),
  });
}