/**
 * Marker gắn thẳng vào hàm middleware để OpenAPI generator nhận diện.
 *
 * KHÔNG so sánh identity hàm (`h === protect`) và KHÔNG dùng Symbol làm key:
 * khi OpenTelemetry Express instrumentation đang chạy (có
 * OTEL_EXPORTER_OTLP_ENDPOINT trong .env), nó thay mọi `router.use(fn)` bằng
 * một hàm bọc tên `patched` và chỉ sao chép các key CHUỖI enumerable
 * (`for...in`) của hàm gốc → identity sai và Symbol bị rơi mất → generator
 * sinh `security: []` trên máy dev nhưng đúng trên CI (không có .env).
 * Key chuỗi enumerable được proxy xuyên qua lớp bọc nên vẫn đọc được.
 * File này cố ý KHÔNG import gì để tránh vòng phụ thuộc.
 */
export const AUTH_MODE = "__jobportalAuthMode";
export const ADMIN_ONLY = "__jobportalAdminOnly";
export const RATE_LIMITER = "__jobportalRateLimiter";

export type AuthMode = "required" | "optional";

export const markAuth = <T extends object>(fn: T, mode: AuthMode): T =>
  Object.assign(fn, { [AUTH_MODE]: mode });

export const markAdminOnly = <T extends object>(fn: T): T =>
  Object.assign(fn, { [ADMIN_ONLY]: true });

export const markRateLimiter = <T extends object>(fn: T, name: string): T =>
  Object.assign(fn, { [RATE_LIMITER]: name });
