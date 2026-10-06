/** Postgres SQLSTATE cho các lỗi ràng buộc hay gặp. */
export const PG_UNIQUE_VIOLATION = "23505";

/**
 * Đọc SQLSTATE từ lỗi TypeORM `QueryFailedError` (nằm ở `driverError.code`,
 * đồng thời được TypeORM sao chép ra `code` của chính error) mà không cần
 * ép kiểu `any` ở nơi gọi.
 */
export const pgErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) return undefined;
  const e = error as { code?: unknown; driverError?: { code?: unknown } };
  const code = e.driverError?.code ?? e.code;
  return typeof code === "string" ? code : undefined;
};

export const isUniqueViolation = (error: unknown): boolean =>
  pgErrorCode(error) === PG_UNIQUE_VIOLATION;
