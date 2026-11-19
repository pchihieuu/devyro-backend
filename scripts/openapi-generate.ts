/**
 * Sinh docs/openapi/openapi.json từ router + validator + catalog.
 *
 *   npm run openapi:generate   → ghi file
 *   npm run openapi:check      → KHÔNG ghi; fail nếu (a) router/catalog lệch nhau,
 *                                 (b) spec không hợp lệ OpenAPI 3.0, (c) file đã
 *                                 commit khác spec sinh ra (quên chạy generate).
 *
 * Không cần DB/Redis thật: chỉ import router để đọc router.stack rồi thoát.
 */
process.env.JWT_SECRET ??= "openapi";
process.env.JWT_REFRESH_SECRET ??= "openapi";
process.env.GEMINI_API_KEY ??= "openapi";
process.env.RABBITMQ_URL ??= "amqp://localhost";
process.env.REDIS_URL ??= "redis://127.0.0.1:6379";
process.env.DB_PASSWORD ??= "openapi";
process.env.DB_DATABASE ??= "openapi";

import fs from "fs";
import path from "path";

const OUT = path.resolve(__dirname, "../docs/openapi/openapi.json");
const checkOnly = process.argv.includes("--check");

const main = async (): Promise<number> => {
  // require sau khi đã set env mặc định (env.config validate ngay khi import).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildOpenApiDocument } = require("../src/openapi/builder");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SwaggerParser = require("@apidevtools/swagger-parser");

  const { document, problems } = buildOpenApiDocument({ version: "1.0.0" });
  let failed = false;

  if (problems.length > 0) {
    console.error("Router and OpenAPI catalog do not match:");
    problems.forEach((p: string) => console.error("  - " + p));
    failed = true;
  }

  try {
    await SwaggerParser.validate(JSON.parse(JSON.stringify(document)));
  } catch (e) {
    console.error("Spec invalid:", (e as Error).message);
    failed = true;
  }

  const next = JSON.stringify(document, null, 2) + "\n";
  const ops = Object.values(document.paths as Record<string, object>).reduce(
    (n, p) => n + Object.keys(p).length,
    0
  );

  if (checkOnly) {
    const current = fs.existsSync(OUT)
      ? fs.readFileSync(OUT, "utf8").replace(/\r\n/g, "\n")
      : "";
    if (current !== next) {
      console.error(
        "docs/openapi/openapi.json is outdated — run `npm run openapi:generate` and then commit."
      );
      failed = true;
    }
  } else if (!failed) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, next);
  }

  console.log(
    failed
      ? "✖ OpenAPI: FAILED"
      : `✔ OpenAPI OK — ${ops} operations, ${Object.keys(document.components.schemas).length} schemas`
  );
  return failed ? 1 : 0;
};

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
