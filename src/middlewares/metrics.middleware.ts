import crypto from "crypto";
import { Express, NextFunction, Request, Response } from "express";
import promBundle from "express-prom-bundle";
import { register, collectDefaultMetrics } from "prom-client";
import { logger } from "../utils/logger";
import { HTTP_STATUS } from "../constants/httpStatus";
import { ApiResponse } from "../utils/api-response";
// Import để các metric DB/Redis được đăng ký vào registry mặc định.
import { httpInFlight } from "../observability/metrics";

/**
 * Label `path` = route pattern của Express (vd `/api/v1/blogs/:slug`), không
 * phải URL thật.
 *
 * BUG FIX: cấu hình cũ dùng regex `\d+` để chuẩn hoá `/jobs/<id>` — nhưng id ở
 * đây là UUID nên regex không bao giờ khớp (code chết). Các route dùng slug
 * (`/blogs/:slug`) và token (`/auth/verify-reset-token/:token`) cũng không
 * được chuẩn hoá → mỗi slug/token là 1 time-series mới, phình bộ nhớ
 * Prometheus. Request không khớp route nào (404, scanner) gộp về
 * `__unmatched__` để kẻ quét URL không tạo vô hạn label.
 */
// Kiểu cấu trúc tối thiểu: express-prom-bundle mang theo bản @types/express
// riêng nên không thể gán trực tiếp `Request` của project.
const normalizePath = (req: {
  baseUrl?: string;
  route?: { path?: unknown };
  res?: { locals?: Record<string, unknown> };
}): string => {
  if (!req.route) return "__unmatched__";
  // BUG FIX: express-prom-bundle gọi hàm này ở sự kiện `finish` — lúc đó Express
  // đã khôi phục `req.baseUrl` về "" nên route gốc của router (`GET /` của
  // /api/v1/jobs, /companies, /blogs, /groups...) bị ghi thành "/" và gộp chung
  // một series. `mountBase` được ghi lại lúc request đi vào router (xem
  // routes/index.ts → recordMountBase).
  const base =
    (req.res?.locals?.mountBase as string | undefined) ?? req.baseUrl ?? "";
  const path = String(req.route.path);
  return `${base}${path === "/" ? "" : path}` || "/";
};

/** Router gọi hàm này để lưu base path trước khi Express khôi phục `req.baseUrl`. */
export const recordMountBase = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.locals.mountBase = req.baseUrl;
  next();
};

/**
 * /metrics tiết lộ route, tải và trạng thái nội bộ. Nếu đặt METRICS_TOKEN thì
 * Prometheus phải gửi `Authorization: Bearer <token>` (cấu hình
 * `authorization.credentials` ở scrape_config). Không đặt = mở như cũ.
 */
const metricsAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = process.env.METRICS_TOKEN;
  const provided = Buffer.from(req.headers.authorization ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  if (
    !token ||
    (provided.length === expected.length && crypto.timingSafeEqual(provided, expected))
  ) {
    next();
    return;
  }
  ApiResponse.error(res, HTTP_STATUS.UNAUTHORIZED, "Unauthorized");
};

export function setupMetrics(app: Express): void {
  collectDefaultMetrics({ prefix: "jobportal_" });

  const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    includeStatusCode: true,
    normalizePath: (req) => normalizePath(req),
    autoregister: false,
    // Mặc định của thư viện chỉ có 6 bucket thô (0.003…10) → p95/p99 sai lệch lớn.
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    // Scrape/uptime/docs không được tính vào SLO latency & error của người dùng.
    excludeRoutes: [/^\/metrics/, /^\/health/, /^\/docs/],
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (/^\/(metrics|health|docs)/.test(req.path)) return next();
    httpInFlight.inc();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      httpInFlight.dec();
    };
    res.once("finish", finish);
    res.once("close", finish);
    next();
  });

  app.use(metricsMiddleware as any);

  app.get("/metrics", metricsAuth, async (_req: Request, res: Response) => {
    try {
      res.set("Content-Type", register.contentType);
      res.end(await register.metrics());
    } catch (err) {
      res.status(500).end(String(err));
    }
  });

  logger.info("Prometheus metrics enabled at GET /metrics");
}
