import type { SuiteFn } from "../types";
import { fakeRes } from "../harness";
import { sleep } from "../harness";
import { UserRole } from "../../../src/entities/User.entity";
import {
  AuthRejection,
  authenticateAccessToken,
} from "../../../src/services/access-token-auth.service";
import {
  optionalAuth,
  protect,
} from "../../../src/middlewares/auth.middleware";
import { sessionRepository } from "../../../src/repositories/session.repository";
import {
  verifyAccessToken,
  generateAccessToken,
} from "../../../src/utils/token.utils";
import { randomUUID } from "crypto";

const reqWith = (token?: string): any => ({
  headers: token ? { authorization: `Bearer ${token}` } : {},
  id: "req-verify",
});

export const run: SuiteFn = async (t, { fx }) => {
  const user = await fx.user(UserRole.EMPLOYER);

  // authenticateAccessToken: cổng chung của HTTP + WebSocket
  const ok = await authenticateAccessToken(fx.tokenFor(user));
  t.ok(
    ok.user.id === user.id && !("password" in ok.user),
    "valid token → return user, DO NOT include password hash"
  );

  await t.rejects(
    () => authenticateAccessToken(fx.tokenFor(user) + "x"),
    (e) => e?.message === "TOKEN_INVALID",
    "token has been modified → TOKEN_INVALID"
  );

  const ghost = generateAccessToken({
    id: randomUUID(),
    email: "g@x.test",
    role: "jobseeker",
  } as never);
  await t.rejects(
    () => authenticateAccessToken(ghost),
    (e) => e instanceof AuthRejection && /not found/i.test(e.message),
    "user does not exist → AuthRejection"
  );

  const revoked = fx.tokenFor(user);
  await sessionRepository.blacklistAccessToken(
    verifyAccessToken(revoked).jti!,
    60
  );
  await t.rejects(
    () => authenticateAccessToken(revoked),
    (e) => e instanceof AuthRejection && e.code === "TOKEN_REVOKED",
    "token in the blacklist → TOKEN_REVOKED"
  );

  // optionalAuth phải tôn trọng thu hồi (bug cũ: bỏ qua blacklist)
  let req = reqWith(revoked);
  let called = 0;
  await optionalAuth(req, fakeRes() as any, () => {
    called++;
  });
  t.ok(
    called === 1 && !req.user,
    "optionalAuth + revoked token → treat as a guest (do not assign req.user)"
  );

  const fresh = fx.tokenFor(user);
  req = reqWith(fresh);
  await optionalAuth(req, fakeRes() as any, () => undefined);
  t.ok(
    req.user?.id === user.id,
    "optionalAuth + valid token → assign req.user"
  );

  req = reqWith();
  called = 0;
  await optionalAuth(req, fakeRes() as any, () => {
    called++;
  });
  t.ok(
    called === 1 && !req.user,
    "optionalAuth without token → proceed as guest"
  );

  // logout-all vô hiệu hoá token cấp trước đó
  const beforeLogoutAll = fx.tokenFor(user);
  await sleep(1100); // iat tính theo giây
  await sessionRepository.invalidateAllSessionsBefore(user.id);
  await t.rejects(
    () => authenticateAccessToken(beforeLogoutAll),
    (e) => e instanceof AuthRejection && e.code === "SESSION_INVALIDATED",
    "logout-all → token cấp trước đó bị từ chối (SESSION_INVALIDATED)"
  );

  // protect: lỗi hạ tầng KHÔNG được báo thành 401
  const repo = sessionRepository as any;
  const original = repo.isAccessTokenBlacklisted;
  repo.isAccessTokenBlacklisted = async () => {
    throw new Error("redis down");
  };
  try {
    const res = fakeRes();
    let passed: unknown;
    await protect(
      reqWith(fx.tokenFor(await fx.user())),
      res as any,
      ((e?: unknown) => {
        passed = e;
      }) as any
    );
    t.ok(
      passed instanceof Error &&
        passed.message === "redis down" &&
        res.statusCode === undefined,
      "Redis error → the `protect` middleware passes the error to the error handler (5xx), avoiding an incorrect 401 response.",
      { statusCode: res.statusCode, passed: String(passed) }
    );
  } finally {
    repo.isAccessTokenBlacklisted = original;
  }

  // protect: token thu hồi → 401 + code, và KHÔNG lộ error.message nội bộ
  const res = fakeRes();
  await protect(reqWith(revoked), res as any, () => undefined);
  t.ok(
    res.statusCode === 401 &&
      res.body?.code === "TOKEN_REVOKED" &&
      !("error" in res.body),
    "protect + revoked token → 401 TOKEN_REVOKED, internal errors are not exposed",
    res.body
  );
};
