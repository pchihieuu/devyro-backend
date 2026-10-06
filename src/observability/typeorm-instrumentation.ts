import { DataSource } from "typeorm";
import { logger } from "../utils/logger";
import { dbQueryDuration, dbQueryErrors, dbSlowQueries } from "./metrics";
import { recordQuery, requestStore } from "./request-context";

/**
 * Đo mọi câu SQL đi qua TypeORM bằng cách bọc `QueryRunner.query` của driver
 * Postgres (điểm nghẽn duy nhất — repository, QueryBuilder, migration và
 * `AppDataSource.query` đều đi qua đây).
 *
 * Vì sao không dùng custom `Logger` của TypeORM: `logQuery()` không nhận thời
 * gian chạy; `logQuerySlow()` chỉ gọi khi vượt maxQueryExecutionTime nên không
 * dựng được histogram cho toàn bộ query.
 *
 * An toàn cho production: log slow-query chỉ ghi SQL đã parametrize ($1, $2…)
 * — KHÔNG ghi giá trị tham số (có thể chứa email, token…).
 */

const SLOW_QUERY_MS = (): number => {
  const n = Number(process.env.DB_SLOW_QUERY_MS);
  return Number.isFinite(n) && n > 0 ? n : 500;
};
const MAX_LOGGED_SQL = 500;

const TRANSACTION_KEYWORDS = new Set([
  "START",
  "BEGIN",
  "COMMIT",
  "ROLLBACK",
  "SAVEPOINT",
  "RELEASE",
]);
const KNOWN_OPERATIONS = new Set([
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "WITH",
]);

export const operationOf = (sql: string): string => {
  const keyword = sql.trimStart().split(/[\s(]/, 1)[0]?.toUpperCase() ?? "";
  if (TRANSACTION_KEYWORDS.has(keyword)) return "TRANSACTION";
  return KNOWN_OPERATIONS.has(keyword) ? keyword : "OTHER";
};

let installed = false;

type QueryFn = (
  this: unknown,
  query: string,
  parameters?: unknown[],
  useStructuredResult?: boolean
) => Promise<unknown>;

/** Gọi 1 lần sau khi DataSource đã initialize. Idempotent. */
export const instrumentTypeOrm = async (
  dataSource: DataSource
): Promise<void> => {
  if (installed) return;

  const runner = dataSource.createQueryRunner();
  const proto = Object.getPrototypeOf(runner) as { query: QueryFn };
  await runner.release();

  const original = proto.query;
  proto.query = async function (this: unknown, query, parameters, structured) {
    const operation = operationOf(query);
    const start = process.hrtime.bigint();
    try {
      return await original.call(this, query, parameters, structured);
    } catch (error) {
      dbQueryErrors.inc({ operation });
      throw error;
    } finally {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      dbQueryDuration.observe({ operation }, seconds);
      if (operation !== "TRANSACTION") recordQuery(query);

      const durationMs = seconds * 1000;
      if (durationMs >= SLOW_QUERY_MS()) {
        dbSlowQueries.inc({ operation });
        logger.warn("Slow query", {
          requestId: requestStore.getStore()?.requestId,
          traceId: requestStore.getStore()?.traceId,
          operation,
          durationMs: Math.round(durationMs),
          sql: query.replace(/\s+/g, " ").trim().slice(0, MAX_LOGGED_SQL),
        });
      }
    }
  };

  installed = true;
};
