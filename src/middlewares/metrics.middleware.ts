import { Express, NextFunction, Request, Response } from "express";
import promBundle from "express-prom-bundle";
import { register, collectDefaultMetrics } from "prom-client";
import { logger } from "../utils/logger";
import { HTTP_STATUS } from "../constants/httpStatus";
import { ApiResponse } from "../utils/api-response";
// Import để các metric DB/Redis được đăng ký vào registry mặc định.
import "../observability/metrics";

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
}): string =>
  req.route ? `${req.baseUrl ?? ""}${String(req.route.path)}` : "__unmatched__";

/**
 * /metrics tiết lộ route, tải và trạng thái nội bộ. Nếu đặt METRICS_TOKEN thì
 * Prometheus phải gửi `Authorization: Bearer <token>` (cấu hình
 * `authorization.credentials` ở scrape_config). Không đặt = mở như cũ.
 */
const metricsAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = process.env.METRICS_TOKEN;
  if (!token || req.headers.authorization === `Bearer ${token}`) {
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
