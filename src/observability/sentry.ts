import * as Sentry from "@sentry/node";

/**
 * Error tracking (tuỳ chọn): chỉ bật khi có SENTRY_DSN — không có DSN thì mọi
 * hàm ở đây là no-op nên dev/CI không cần cấu hình gì.
 *
 * PHẢI được import trước `express`/`pg`/`ioredis` (xem server.ts) để Sentry
 * kịp gắn auto-instrumentation. `SENTRY_TRACES_SAMPLE_RATE` (0–1, mặc định 0)
 * bật distributed tracing (span HTTP/Postgres/Redis) khi cần, không cần thêm
 * collector.
 */
import { currentTraceId, otelEnabled } from "./tracing";

const dsn = process.env.SENTRY_DSN;

export const sentryEnabled = Boolean(dsn);

if (dsn) {
  const rate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE);
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE,
    sendDefaultPii: false,
    // Không bao giờ gửi token/cookie/mật khẩu lên Sentry dù lỡ nằm trong request.
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.headers) {
          for (const h of ["authorization", "cookie", "x-api-key"]) {
            delete event.request.headers[h];
          }
        }
      }
      return event;
    },
    // Khi đã bật OpenTelemetry riêng (tracing.ts), Sentry KHÔNG được tự dựng
    // TracerProvider thứ 2 (2 provider cùng đăng ký global sẽ xung đột) — chỉ
    // dùng Sentry để bắt lỗi; trace do OTel + collector của bạn lo.
    ...(otelEnabled
      ? { skipOpenTelemetrySetup: true }
      : {
          tracesSampleRate: Number.isFinite(rate)
            ? Math.min(Math.max(rate, 0), 1)
            : 0,
        }),
  });
}

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
}

export const captureError = (error: unknown, ctx: ErrorContext = {}): void => {
  if (!sentryEnabled) return;
  Sentry.withScope((scope) => {
    if (ctx.requestId) scope.setTag("requestId", ctx.requestId);
    // Nhảy từ lỗi Sentry sang trace trong Grafana Tempo.
    const traceId = currentTraceId();
    if (traceId) scope.setTag("traceId", traceId);
    if (ctx.userId) scope.setUser({ id: ctx.userId });
    scope.setContext("request", {
      method: ctx.method,
      url: ctx.url,
      statusCode: ctx.statusCode,
    });
    Sentry.captureException(error);
  });
};

export const flushSentry = async (timeoutMs = 2000): Promise<void> => {
  if (sentryEnabled) await Sentry.flush(timeoutMs);
};
