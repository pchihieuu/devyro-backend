import type { DataSource } from "typeorm";

/**
 * CHỐT AN TOÀN: verify chỉ được chạm vào database có tên kết thúc bằng
 * `_test`. Kiểm tra 2 lần:
 *  1. Trước khi kết nối (từ biến môi trường) — để báo lỗi sớm, dễ hiểu.
 *  2. Sau khi kết nối, hỏi chính Postgres `current_database()` — đây mới là
 *     sự thật (không tin env), và được kiểm lại TRƯỚC MỌI thao tác phá huỷ.
 */
const TEST_DB_PATTERN = /_test$/;

export class UnsafeTargetError extends Error {}

export const assertTestEnv = (): void => {
  const name = process.env.DB_DATABASE ?? "";
  if (!TEST_DB_PATTERN.test(name)) {
    throw new UnsafeTargetError(
      `DB_DATABASE="${name}" does not end with "_test". ` +
        `The 'verify' operation will TRUNCATE data, so it should only be run on databases with names ending in *_test ` +
        `(e.g., job_portal_test). Please check your .env.test file.`
    );
  }
};

export const assertTestDatabase = async (ds: DataSource): Promise<string> => {
  const [row]: Array<{ db: string }> = await ds.query(
    "SELECT current_database() AS db"
  );
  if (!row || !TEST_DB_PATTERN.test(row.db)) {
    throw new UnsafeTargetError(
      `Connecting to database "${row?.db}" — NOT a *_test database. Stop immediately, nothing deleted.`
    );
  }
  return row.db;
};

export const describeTarget = (): string => {
  const redis = (process.env.REDIS_URL ?? "").replace(/\/\/[^@/]*@/, "//***@");
  return (
    `Postgres ${process.env.DB_USERNAME}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}` +
    `  |  Redis ${redis}`
  );
};
