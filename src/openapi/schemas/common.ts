import { z } from "zod";

/**
 * Primitive + envelope schema dùng chung cho OpenAPI (CHỈ mô tả response —
 * request lấy trực tiếp từ validator Zod thật nên không thể lệch).
 *
 * Quy ước: schema nào cần xuất hiện ở `components.schemas` thì gắn
 * `.meta({ id: "Tên" })`; còn lại được inline.
 */

export const isoDate = z.iso.datetime({ offset: true });
export const uuid = z.uuid();

/**
 * TypeORM trả cột `decimal` của Postgres dưới dạng STRING ("1500.00") vì
 * entity không có transformer. Tài liệu hoá đúng wire format để FE biết phải
 * `Number()` khi tính toán/hiển thị (xem mục Bug trong báo cáo).
 */
export const decimalString = z
  .string()
  .meta({ description: "Decimal as a string (Postgres decimal)" });

export const paginationMeta = z
  .object({
    currentPage: z.number().int(),
    totalPages: z.number().int(),
    total: z.number().int(),
    limit: z.number().int(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean(),
  })
  .meta({ id: "PaginationMeta" });

export const fieldError = z
  .object({
    field: z.string().nullable().meta({ description: "Name of the field with an error, null if it's a general error" }),
    message: z.string(),
  })
  .meta({ id: "FieldError" });

export const apiError = z
  .object({
    success: z.literal(false),
    message: z.string(),
    errors: z.array(fieldError),
    code: z.string().optional().meta({
      description: "Error code readable by machines (e.g., TOKEN_EXPIRED) — only present in some errors",
    }),
    requestId: z
      .string()
      .optional()
      .meta({ description: "Matches header X-Request-Id — sent along with error reports" }),
  })
  .meta({ id: "ApiError" });

/** Response chỉ có message (delete, mark-as-read, logout...). */
export const messageOnly = z.object({}).meta({ id: "_MessageOnly" });

export const userRef = z
  .object({
    id: uuid,
    name: z.string(),
    avatar: z.string().nullable(),
  })
  .meta({ id: "UserRef" });
