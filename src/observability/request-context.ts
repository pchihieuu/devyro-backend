import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";
import { dbQueriesPerRequest, nPlusOneSuspects } from "./metrics";
import { currentTraceId } from "./tracing";
import { RequestStore, requestStore } from "./als";

export { requestStore, getRequestId } from "./als";

/**
 * Context theo từng HTTP request (AsyncLocalStorage) để:
 *  - gắn requestId vào log slow-query mà không phải truyền tham số qua mọi tầng;
 *  - đếm số SQL của request và phát hiện N+1 (cùng 1 câu SQL đã parametrize
 *    chạy lặp lại nhiều lần) — thay cho việc soát tay.
 */

const envInt = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// Đọc lúc gọi (không cache lúc import) để dotenv/config kịp nạp.
const queryCountWarn = () => envInt("DB_QUERY_COUNT_WARN", 30);
const nPlusOneThreshold = () => envInt("N_PLUS_ONE_THRESHOLD", 10);

const MAX_TRACKED_FINGERPRINTS = 200;
const MAX_FINGERPRINT_LENGTH = 300;

/** Ghi nhận 1 câu SQL vào request hiện tại (no-op ngoài HTTP request: worker, cron...). */
export const recordQuery = (sql: string): void => {
  const store = requestStore.getStore();
  if (!store) return;

  store.queryCount += 1;
  const fingerprint = sql.replace(/\s+/g, " ").trim().slice(0, MAX_FINGERPRINT_LENGTH);
  const current = store.fingerprints.get(fingerprint);
  if (current !== undefined) {
    store.fingerprints.set(fingerprint, current + 1);
  } else if (store.fingerprints.size < MAX_TRACKED_FINGERPRINTS) {
    store.fingerprints.set(fingerprint, 1);
  }
};

/** Route pattern (vd `/api/v1/jobs/:id`) — không dùng URL thật để tránh cardinality cao. */
export const routeLabel = (req: Request): string =>
  req.route ? `${req.baseUrl}${req.route.path}` : "__unmatched__";

const report = (req: Request, store: RequestStore): void => {
  if (store.queryCount === 0) return;

  const route = routeLabel(req);
  dbQueriesPerRequest.observe({ route }, store.queryCount);

  let topSql = "";
  let topRepeat = 0;
  for (const [sql, count] of store.fingerprints) {
    if (count > topRepeat) {
      topRepeat = count;
      topSql = sql;
    }
  }

  const suspectedNPlusOne = topRepeat >= nPlusOneThreshold();
  if (suspectedNPlusOne) nPlusOneSuspects.inc({ route });

  if (suspectedNPlusOne || store.queryCount >= queryCountWarn()) {
    logger.warn(
      suspectedNPlusOne
        ? "Possible N+1: same query repeated within one request"
        : "High DB query count for one request",
      {
        requestId: store.requestId,
        traceId: store.traceId,
        method: req.method,
        route,
        queryCount: store.queryCount,
        topRepeat,
        topQuery: topSql,
      }
    );
  }
};

export const requestContext = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const store: RequestStore = {
    requestId: req.id,
    traceId: currentTraceId(),
    queryCount: 0,
    fingerprints: new Map(),
  };
  res.once("finish", () => report(req, store));
  requestStore.run(store, next);
};
