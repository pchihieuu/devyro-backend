import { Response } from "express";
import { PaginatedResult, buildPaginationMeta } from "./pagination.util";

export function sendPaginated<T>(res: Response, result: PaginatedResult<T>): void {
  res.json({
    success: true,
    data: result.items,
    pagination: buildPaginationMeta(result),
  });
}