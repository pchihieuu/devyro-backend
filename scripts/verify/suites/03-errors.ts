import type { SuiteFn } from "../types";
import { fakeRes } from "../harness";
import { errorHandler } from "../../../src/middlewares/error.middleware";
import { ForbiddenError } from "../../../src/utils/errors";

const handle = (err: Error) => {
  const res = fakeRes();
  const req: any = {
    id: "req-verify",
    url: "/x",
    originalUrl: "/x",
    method: "GET",
    ip: "127.0.0.1",
  };
  errorHandler(err, req, res as any, () => undefined);
  return res;
};

const capture = async (fn: () => Promise<unknown>): Promise<Error> => {
  try {
    await fn();
  } catch (e) {
    return e as Error;
  }
  throw new Error("The SQL command should have resulted in an error.");
};

export const run: SuiteFn = async (t, { ds, fx }) => {
  // unique_violation (23505) → 409
  const u = await fx.user();
  const dupe = await capture(() =>
    ds.query(
      `INSERT INTO users (name, email, password, role) VALUES ('dup', $1, 'x', 'jobseeker')`,
      [u.email]
    )
  );
  let r = handle(dupe);
  t.ok(
    r.statusCode === 409 && r.body?.success === false,
    "unique violation (23505) → 409",
    r.body
  );

  // invalid_text_representation (22P02) → 400
  const badUuid = await capture(() =>
    ds.query(`SELECT $1::uuid`, ["not-a-uuid"])
  );
  r = handle(badUuid);
  t.ok(r.statusCode === 400, "invalid uuid format (22P02) → 400", r.body);

  // statement_timeout (57014) → 503, KHÔNG phải 400
  const qr = ds.createQueryRunner();
  let timeoutErr: Error | undefined;
  try {
    await qr.startTransaction();
    await qr.query(`SET LOCAL statement_timeout = 50`);
    await qr.query(`SELECT pg_sleep(1)`);
  } catch (e) {
    timeoutErr = e as Error;
  } finally {
    await qr.rollbackTransaction().catch(() => undefined);
    await qr.release();
  }
  t.ok(!!timeoutErr, "managed to actually trigger a statement_timeout error");
  if (timeoutErr) {
    r = handle(timeoutErr);
    t.ok(
      r.statusCode === 503,
      "statement_timeout (57014) → 503 (previously grouped under 400)",
      r.body
    );
  }

  // Lỗi lạ → 500 và KHÔNG lộ message nội bộ
  r = handle(new Error("password=hunter2 host=10.0.0.5"));
  t.ok(
    r.statusCode === 500 && !JSON.stringify(r.body).includes("hunter2"),
    "unforeseen error → 500, does not expose internal details",
    r.body
  );

  // AppError đi qua nguyên vẹn
  r = handle(new ForbiddenError("Unauthorized"));
  t.ok(
    r.statusCode === 403 &&
      r.body?.message === "Unauthorized" &&
      r.body?.requestId === "req-verify",
    "AppError preserves the status/message and attaches a requestId.",
    r.body
  );

  // body-parser: payload quá lớn
  const tooLarge = Object.assign(new Error("request entity too large"), {
    type: "entity.too.large",
    status: 413,
  });
  r = handle(tooLarge);
  t.ok(r.statusCode === 413, "payload too large → 413", r.body);
};
