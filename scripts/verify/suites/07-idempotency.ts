import express from "express";
import type { Server } from "http";
import type { SuiteFn } from "../types";
import { idempotency } from "../../../src/middlewares/idempotency.middleware";
import { errorHandler } from "../../../src/middlewares/error.middleware";
import { ApiResponse } from "../../../src/utils/api-response";
import { sleep } from "../harness";

export const run: SuiteFn = async (t, { ds, fx, http, runId }) => {
  // App mini để kiểm soát số lần handler chạy
  let handled = 0;
  let failNext = false;
  let delayMs = 0;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const uid = req.header("x-test-user");
    if (uid) (req as any).user = { id: uid };
    next();
  });
  app.post("/x", idempotency(), async (_req, res) => {
    handled++;
    if (delayMs) await sleep(delayMs);
    if (failNext) {
      failNext = false;
      res.status(400).json({ success: false, message: "bad" });
      return;
    }
    ApiResponse.created(res, { n: handled });
  });
  app.use(errorHandler);
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const call = (key: string | null, body: unknown = {}, user?: string) =>
    fetch(`${base}/x`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key ? { "Idempotency-Key": key } : {}),
        ...(user ? { "x-test-user": user } : {}),
      },
      body: JSON.stringify(body),
    });
  const key = (label: string) =>
    `${label}-${runId}-${Math.random().toString(36).slice(2, 10)}`;

  try {
    // Replay
    const k1 = key("replay");
    const r1 = await call(k1, { a: 1 });
    const r2 = await call(k1, { a: 1 });
    const [b1, b2] = [(await r1.json()) as any, (await r2.json()) as any];
    t.ok(
      r1.status === 201 &&
        r2.status === 201 &&
        r2.headers.get("idempotency-replayed") === "true" &&
        r1.headers.get("idempotency-replayed") === null,
      "resend with the same key + payload → return the original response, including an Idempotency-Replayed"
    );
    t.ok(
      handled === 1 && b1.data.n === b2.data.n,
      "The handler runs only once."
    );

    // Cùng key, payload khác
    const r3 = await call(k1, { a: 2 });
    t.eq(r3.status, 422, "same key but different payload → 422");

    // Không có header → hành vi cũ
    const before = handled;
    await call(null);
    await call(null);
    t.eq(
      handled - before,
      2,
      "no Idempotency-Key sent → no deduplication (backward compatibility)"
    );

    // Định dạng key không hợp lệ
    t.eq(
      (await call("short")).status,
      400,
      "key has an incorrect format (too short) → 400"
    );

    // Khoá theo user
    const k2 = key("users");
    const [u1, u2] = [
      await call(k2, {}, "user-A"),
      await call(k2, {}, "user-B"),
    ];
    t.ok(
      u1.status === 201 &&
        u2.status === 201 &&
        u2.headers.get("idempotency-replayed") === null,
      "same key but different user → independent"
    );

    // Đồng thời: 1 thắng, còn lại 409
    delayMs = 300;
    const baseline = handled;
    const k3 = key("concurrent");
    const rs = await Promise.all([call(k3), call(k3), call(k3)]);
    delayMs = 0;
    t.eq(
      rs.map((r) => r.status).sort(),
      [201, 409, 409],
      "3 simultaneous requests using the same key → [201, 409, 409]"
    );
    t.eq(handled - baseline, 1, "…and the handler runs only once");

    // Lỗi 4xx nhả khoá để client retry
    const k4 = key("retry");
    failNext = true;
    t.eq((await call(k4)).status, 400, "first attempt handler returns 400");
    const retry = await call(k4);
    t.ok(
      retry.status === 201 &&
        retry.headers.get("idempotency-replayed") === null,
      "retry same key after 4xx error → processed again (not stuck)"
    );
  } finally {
    await new Promise((r) => server.close(() => r(null)));
  }

  // Trên route thật: POST /groups
  const user = await fx.user();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${fx.tokenFor(user)}`,
    "Idempotency-Key": key("real-route"),
  };
  const body = JSON.stringify({ name: `Idem Group ${runId}`, memberIds: [] });
  const g1 = await http("/api/v1/groups", { method: "POST", headers, body });
  const g2 = await http("/api/v1/groups", { method: "POST", headers, body });
  t.ok(
    g1.status === 201 &&
      g2.status === 201 &&
      g2.headers.get("idempotency-replayed") === "true" &&
      g1.body?.data?.id === g2.body?.data?.id,
    "POST /groups: on the second attempt, it returns the same original group",
    { g1: g1.body, g2: g2.body }
  );
  const [{ n }] = await ds.query(
    `SELECT COUNT(*)::int AS n FROM groups WHERE name = $1`,
    [`Idem Group ${runId}`]
  );
  t.eq(
    n,
    1,
    "DB only has 1 group (double-submit does not create a second record)"
  );
};
