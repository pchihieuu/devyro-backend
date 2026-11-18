import { EventEmitter } from "events";
import { register } from "prom-client";
import type { SuiteFn } from "../types";
import { logger } from "../../../src/utils/logger";
import { redisClient } from "../../../src/config/redis.config";
import {
  requestContext,
  requestStore,
  recordQuery,
} from "../../../src/observability/request-context";
import { operationOf } from "../../../src/observability/typeorm-instrumentation";

/** Bắt log của logger (không phụ thuộc LOG_LEVEL / silent). */
const captureLogs = () => {
  const entries: Array<{ level: string; message: string; meta: any }> = [];
  const l = logger as any;
  const original = { warn: l.warn, error: l.error };
  l.warn = (message: string, meta: any) =>
    entries.push({ level: "warn", message, meta });
  l.error = (message: string, meta: any) =>
    entries.push({ level: "error", message, meta });
  return { entries, restore: () => Object.assign(l, original) };
};

const counterValue = async (
  name: string,
  match: Record<string, string>
): Promise<number> => {
  const metric: any = register.getSingleMetric(name);
  const { values } = await metric.get();
  return values
    .filter((v: any) =>
      Object.entries(match).every(([k, val]) => v.labels[k] === val)
    )
    .reduce((sum: number, v: any) => sum + v.value, 0);
};

export const run: SuiteFn = async (t, { ds, runId }) => {
  // Phân loại operation
  t.ok(
    operationOf("  SELECT 1") === "SELECT" &&
      operationOf("START TRANSACTION") === "TRANSACTION" &&
      operationOf("WITH x AS (SELECT 1) SELECT 1") === "WITH" &&
      operationOf("VACUUM") === "OTHER",
    "operationOf: SELECT / TRANSACTION / WITH / OTHER"
  );

  // Histogram thời gian SQL
  await ds.query("SELECT 1");
  const text = await register.metrics();
  t.ok(
    /jobportal_db_query_duration_seconds_count\{operation="SELECT"\} \d+/.test(
      text
    ),
    "An SQL timing histogram is output, with an operation label."
  );
  t.ok(
    text.includes("jobportal_db_slow_queries_total"),
    "counter for slow queries registered"
  );

  // Đếm query theo request
  const store = {
    requestId: "r1",
    traceId: undefined,
    queryCount: 0,
    fingerprints: new Map<string, number>(),
  };
  await requestStore.run(store, async () => {
    for (let i = 0; i < 12; i++)
      await ds.query("SELECT 1 AS x WHERE $1::int = $1::int", [i]);
  });
  t.ok(
    store.queryCount === 12 && [...store.fingerprints.values()][0] === 12,
    "Count the 12 queries and consolidate identical SQL statements (which differ only by their parameters) into a single form."
  );
  recordQuery("SELECT outside"); // ngoài HTTP request: không được ném lỗi
  t.ok(true, "recordQuery` is a no-op outside of a request context.");

  // Slow query: có log, KHÔNG lộ giá trị tham số
  const prevSlow = process.env.DB_SLOW_QUERY_MS;
  process.env.DB_SLOW_QUERY_MS = "1";
  const cap = captureLogs();
  try {
    await requestStore.run(
      {
        requestId: `req-${runId}`,
        traceId: undefined,
        queryCount: 0,
        fingerprints: new Map(),
      },
      () =>
        ds.query("SELECT pg_sleep(0.03), $1::text AS v", ["TOP-SECRET-VALUE"])
    );
  } finally {
    cap.restore();
    if (prevSlow === undefined) delete process.env.DB_SLOW_QUERY_MS;
    else process.env.DB_SLOW_QUERY_MS = prevSlow;
  }
  const slow = cap.entries.find((e) => e.message === "Slow query");
  t.ok(
    !!slow &&
      slow.meta.requestId === `req-${runId}` &&
      slow.meta.durationMs >= 1 &&
      /SELECT/.test(slow.meta.sql),
    "query exceeds threshold → log WARN 'Slow query' including requestId, durationMs, and sql",
    slow
  );
  t.ok(
    !JSON.stringify(cap.entries).includes("TOP-SECRET-VALUE") &&
      /\$1/.test(slow?.meta?.sql ?? ""),
    "The slow query log contains only parameterized SQL ($1); it does NOT include the actual parameter values."
  );

  // Phát hiện N+1 qua middleware thật
  const prevN1 = process.env.N_PLUS_ONE_THRESHOLD;
  process.env.N_PLUS_ONE_THRESHOLD = "5";
  const cap2 = captureLogs();
  try {
    const req: any = {
      id: "req-n1",
      method: "GET",
      baseUrl: "/api/v1/verify",
      route: { path: "/:id" },
    };
    const res: any = new EventEmitter();
    await new Promise<void>((resolve) => {
      requestContext(req, res, () => {
        (async () => {
          for (let i = 0; i < 8; i++)
            await ds.query("SELECT 2 AS y WHERE $1::int >= 0", [i]);
          res.emit("finish");
          resolve();
        })();
      });
    });
  } finally {
    cap2.restore();
    if (prevN1 === undefined) delete process.env.N_PLUS_ONE_THRESHOLD;
    else process.env.N_PLUS_ONE_THRESHOLD = prevN1;
  }
  const n1 = cap2.entries.find((e) => /N\+1/.test(e.message));
  t.ok(
    !!n1 && n1.meta.topRepeat === 8 && n1.meta.route === "/api/v1/verify/:id",
    "A single SQL query repeated 8 times (threshold: 5) → N+1 warning, including the route pattern",
    n1
  );
  t.ok(
    (await counterValue("jobportal_n_plus_one_suspects_total", {
      route: "/api/v1/verify/:id",
    })) >= 1,
    "metric n_plus_one_suspects_total increased"
  );

  // Redis hit/miss theo prefix
  const key = `auth:userCache:verify-${runId}`;
  await redisClient.del(key);
  const sample = async (result: string) =>
    counterValue("jobportal_redis_cache_operations_total", {
      prefix: "auth:userCache",
      result,
    });
  const [miss0, hit0] = [await sample("miss"), await sample("hit")];
  await redisClient.get(key); // chưa có → miss
  await redisClient.set(key, "1", "EX", 30);
  await redisClient.get(key); // có → hit
  await redisClient.del(key);
  t.eq(
    (await sample("miss")) - miss0,
    1,
    "GET key not found → miss +1 (prefix auth:userCache)"
  );
  t.eq((await sample("hit")) - hit0, 1, "GET key already exists → hit +1");
  t.ok(
    /jobportal_redis_command_duration_seconds_count\{command="get"\} \d+/.test(
      await register.metrics()
    ),
    "Redis command latency histogram with a 'command' label"
  );
};
