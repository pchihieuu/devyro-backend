import { missingExplicit, loadedEnvFile } from "./env";
import http from "http";
import { randomBytes } from "crypto";
import { SUITES, SuiteMeta } from "./registry";
import { T, bold, dim, green, red, yellow } from "./harness";
import {
  UnsafeTargetError,
  assertTestDatabase,
  assertTestEnv,
  describeTarget,
} from "./guard";
import type { Ctx, HttpResult } from "./types";

const USAGE = `
Cách dùng: npm run verify -- [tuỳ chọn]

  --list           Liệt kê các suite và tiêu chí chúng kiểm tra (không cần DB)
  --only a,b       Chỉ chạy các suite có id này (vd --only outbox,idempotency)
  --bail           Dừng ngay khi có suite đầu tiên thất bại
  --verbose        Hiện log của ứng dụng (mặc định tắt để output gọn)
  --help           Hiện trợ giúp

Chỉ chạy trên database có tên kết thúc bằng "_test". Xem docs/VERIFY.md.
`;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const selectSuites = (): SuiteMeta[] => {
  const only = option("--only");
  if (!only) return SUITES;
  const wanted = only
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const unknown = wanted.filter((id) => !SUITES.some((s) => s.id === id));
  if (unknown.length) {
    console.error(red(`Suite does not exist: ${unknown.join(", ")}`));
    console.error(`  Valid: ${SUITES.map((s) => s.id).join(", ")}`);
    process.exit(2);
  }
  return SUITES.filter((s) => wanted.includes(s.id));
};

const SUITE_TIMEOUT_MS = 90_000;

async function main(): Promise<number> {
  if (flag("--help") || flag("-h")) {
    console.log(USAGE);
    return 0;
  }
  if (flag("--list")) {
    for (const s of SUITES) {
      console.log(`${bold(s.id.padEnd(14))} ${s.title}`);
      for (const c of s.covers) console.log(`  ${dim("-")} ${c}`);
    }
    return 0;
  }

  // 1. Chốt an toàn (trước khi kết nối bất cứ thứ gì)
  if (missingExplicit.length) {
    console.error(
      red("Missing test configuration:"),
      missingExplicit.join(", ")
    );
    console.error(
      `  verify does not read DB/Redis from .env to avoid confusion with dev environment.\n` +
        `  Please copy .env.test.example to .env.test and fill in all required variables.` +
        (loadedEnvFile ? "" : `\n  (Did not find .env.test file)`)
    );
    return 2;
  }
  try {
    assertTestEnv();
  } catch (e) {
    console.error(red("✖ " + (e as Error).message));
    return 2;
  }
  console.log(bold("Target:"), describeTarget());

  const suites = selectSuites();

  // 2. Kết nối + kiểm lại database thật sự đang dùng
  const { AppDataSource: ds } = require("../../src/config/database.config");
  const { logger } = require("../../src/utils/logger");
  if (!flag("--verbose")) logger.silent = true;
  else process.env.VERIFY_VERBOSE = "1";

  await ds.initialize();
  try {
    const db = await assertTestDatabase(ds);
    console.log(bold("Database confirmed:"), db, "\n");
  } catch (e) {
    console.error(red("✖ " + (e as Error).message));
    await ds.destroy();
    return 2;
  }

  const {
    instrumentTypeOrm,
  } = require("../../src/observability/typeorm-instrumentation");
  await instrumentTypeOrm(ds);

  const runId = randomBytes(4).toString("hex");
  const { Fixtures } = require("./fixtures");

  let server: http.Server | undefined;
  let base: string | undefined;

  const ctx: Ctx = {
    ds,
    runId,
    fx: new Fixtures(ds, runId),
    async baseUrl() {
      if (base) return base;
      const app = require("../../src/app").default;
      server = await new Promise<http.Server>((resolve) => {
        const s: http.Server = app.listen(0, () => resolve(s));
      });
      const addr = server.address();
      base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
      return base;
    },
    async http(path, init): Promise<HttpResult> {
      const res = await fetch((await ctx.baseUrl()) + path, init);
      const text = await res.text();
      let body: any = text;
      try {
        body = JSON.parse(text);
      } catch {}
      return { status: res.status, headers: res.headers, body };
    },
    async truncate(...tables) {
      await assertTestDatabase(ds); // kiểm lại NGAY trước mỗi lần xoá
      if (tables.length === 0) return;
      const list = tables.map((t) => `"${t.replace(/"/g, "")}"`).join(", ");
      await ds.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    },
  };

  // 3. Dựng schema (migration) rồi xoá sạch dữ liệu cũ
  await ds.runMigrations();
  const tables: Array<{ tablename: string }> = await ds.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations'`
  );
  await ctx.truncate(...tables.map((r) => r.tablename));

  // 4. Chạy từng suite
  const results: Array<{
    meta: SuiteMeta;
    t: T;
    crashed?: string;
    ms: number;
  }> = [];
  for (const meta of suites) {
    console.log(bold(`\n▶ ${meta.id}`) + dim(` — ${meta.title}`));
    const t = new T();
    const started = Date.now();
    let crashed: string | undefined;
    let watchdog: NodeJS.Timeout | undefined;
    try {
      const run = meta.load();
      await Promise.race([
        run(t, ctx),
        new Promise<never>((_, reject) => {
          watchdog = setTimeout(
            () =>
              reject(
                new Error(
                  `Suite took over  ${SUITE_TIMEOUT_MS / 1000}s - suspected hang`
                )
              ),
            SUITE_TIMEOUT_MS
          );
        }),
      ]);
    } catch (e) {
      crashed = e instanceof Error ? (e.stack ?? e.message) : String(e);
      t.ok(false, "Suite failed during execution", crashed);
    } finally {
      if (watchdog) clearTimeout(watchdog);
    }
    results.push({ meta, t, crashed, ms: Date.now() - started });
    if (flag("--bail") && t.failed > 0) {
      console.log(yellow("\n--bail: stop after the first failed suite."));
      break;
    }
  }

  console.log(bold("\n══ Summary ══"));
  let passed = 0;
  let failed = 0;
  for (const { meta, t, ms } of results) {
    passed += t.passed;
    failed += t.failed;
    const status = t.failed ? red("FAIL") : green("PASS");
    console.log(
      `${status}  ${meta.id.padEnd(14)} ${String(t.passed).padStart(3)} passed, ${String(t.failed).padStart(2)} failed  ${dim(`(${ms}ms)`)}`
    );
  }
  console.log(
    `\n${failed ? red("✖ HAS ERRORS") : green("✔ ALL PASSED")} — ${passed} passed, ${failed} failed, ${results.length}/${suites.length} suites.`
  );
  if (failed) {
    console.log(red("\nFailed tests:"));
    for (const { meta, t } of results)
      for (const f of t.failures) console.log(`  [${meta.id}] ${f}`);
  }

  // 6. Dọn dẹp
  if (server) await new Promise((r) => server!.close(() => r(null)));
  await ds.destroy();
  require("../../src/config/redis.config").redisClient.disconnect();
  return failed ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    if (e instanceof UnsafeTargetError) console.error(red("✖ " + e.message));
    else console.error(red("✖ Unexpected error:"), e);
    process.exit(2);
  });
