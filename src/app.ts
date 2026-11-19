import "reflect-metadata";
import express, { Express } from "express";
import cors from "cors";
import morgan from "morgan";
import { logger, morganStream } from "./utils/logger";
import { requestId } from "./middlewares/requestId.middleware";
import { requestContext } from "./observability/request-context";
import { apiLimiter } from "./middlewares/rateLimiter.middleware";
import { apiRouters } from "./routes";
import docsRoutes, { warnOpenApiProblems } from "./routes/docs.route";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { API_PREFIX, ROUTES } from "./constants/routes";
import helmet from "helmet";
import { config } from "./config/env.config";
import cookieParser from "cookie-parser";
import { recordMountBase, setupMetrics } from "./middlewares/metrics.middleware";

const app: Express = express();

// Must run before everything else — every log line and error response
// downstream (including inside setupMetrics/helmet) can reference req.id.
app.use(requestId);

// Mở AsyncLocalStorage cho từng request (requestId + đếm SQL) — dùng để gắn
// requestId vào log slow-query và phát hiện N+1. Phải nằm ngay sau requestId.
app.use(requestContext);

setupMetrics(app);

// OBSERVABILITY GAP: morgan was a declared dependency with a ready-made
// morganStream (utils/logger.ts) but was never actually registered — there
// was no HTTP access log at all, only whatever individual
// controllers/services happened to console.log. This gives every request a
// structured line (status, latency, correlation id) regardless of whether
// the handler logs anything itself.
morgan.token("id", (req) => (req as any).id ?? "-");
app.use(
  morgan(":id :method :url :status :res[content-length] - :response-time ms", {
    stream: morganStream,
  })
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
        connectSrc: ["'self'", config.frontendUrl],
      },
    },
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = Array.isArray(config.cors.origin)
        ? config.cors.origin
        : [config.cors.origin];

      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, origin);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    // X-Request-Id: LB/gateway hoặc FE có thể gửi để nối trace (requestId.middleware
    // đọc header này) — thiếu ở allowedHeaders thì preflight của browser sẽ chặn.
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Idempotency-Key",
      "X-Request-Id",
    ],
    exposedHeaders: ["set-cookie", "X-Request-Id", "Idempotency-Replayed"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.set("trust proxy", 1);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Global limiter cho toàn bộ /api/v1/*. Key theo user id (fallback IP) và
// bỏ qua các route polling nhẹ — xem chi tiết & lý do trong
// rateLimiter.middleware.ts. Mount sau health check (uptime monitor không
// bị throttle) và trước các route cụ thể, nên các limiter chặt hơn
// (authLimiter, uploadLimiter, ...) vẫn áp dụng chồng lên cho endpoint cần
// ngưỡng thấp hơn mức chung.
app.use(API_PREFIX, apiLimiter);

// Swagger UI + /docs/openapi.json (bật/tắt qua DOCS_ENABLED, xem env.config.ts).
if (config.docs.enabled) {
  app.use(ROUTES.DOCS.BASE, docsRoutes);
  warnOpenApiProblems();
}

// Danh sách router nằm ở routes/index.ts (dùng chung với OpenAPI generator).
for (const { base, router } of apiRouters) {
  app.use(`${API_PREFIX}${base}`, recordMountBase, router);
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
