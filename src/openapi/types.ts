import { ZodType } from "zod";

/**
 * Metadata mô tả RESPONSE của 1 endpoint. Phần request (params/query/body),
 * auth, idempotency, rate-limit được suy ra TỰ ĐỘNG từ chính router +
 * middleware (xem introspect.ts) nên không khai báo lại ở đây.
 */
export type RoleName = "jobseeker" | "employer" | "admin";

export interface OpSpec {
  summary: string;
  description?: string;
  /** Default = module name in the URL (e.g., /jobs → "jobs"). */
  tag?: string;
  /** Roles allowed — checked in controller/service so must be declared manually. */
  roles?: RoleName[];
  /** Success status. Default is 200. */
  status?: 200 | 201;
  /** Schema of the `data` field. For `paginated` responses, this is the schema of a single item. */
  data?: ZodType;
  /** `data` is an array and includes a standard `pagination` object. */
  paginated?: boolean;
  /** Schema of the `meta` field. */
  meta?: ZodType;
  /** Additional top-level keys (maintaining compatibility with the legacy frontend, e.g., `counts`). */
  extra?: Record<string, ZodType>;
  /** Endpoint that accepts multipart/form-data with one file.*/
  multipart?: { field: string; description?: string };
  /** Endpoint that uses the `refreshToken` cookie instead of Bearer token. */
  usesRefreshCookie?: boolean;
  /** Response set/clear cookie `refreshToken`. */
  setsRefreshCookie?: boolean;
  /** Status for specific business-related errors → description. */
  errors?: Record<number, string>;
  deprecated?: boolean;
}

/** Keys in the format "POST /auth/login" — paths relative to the API prefix, using Express-style syntax (`:id`). */
export type OpCatalog = Record<string, OpSpec>;
