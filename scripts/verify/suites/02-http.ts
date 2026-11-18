import type { SuiteFn } from "../types";
import { sessionRepository } from "../../../src/repositories/session.repository";
import { verifyAccessToken } from "../../../src/utils/token.utils";

const API = "/api/v1";

const isEnvelopeError = (b: any) =>
  b &&
  b.success === false &&
  typeof b.message === "string" &&
  Array.isArray(b.errors);

export const run: SuiteFn = async (t, { fx, http, runId }) => {
  const user = await fx.user();
  const token = fx.tokenFor(user);
  const auth = { Authorization: `Bearer ${token}` };
  const json = { "Content-Type": "application/json" };

  // Health / 404
  const health = await http("/health");
  t.eq(health.status, 200, "GET /health → 200");

  const nf = await http(`/khong-ton-tai-${runId}`);
  t.ok(
    nf.status === 404 && isEnvelopeError(nf.body),
    "404 returns correct envelope {success:false,message,errors}",
    nf.body
  );
  t.ok(
    typeof nf.body?.requestId === "string" &&
      nf.headers.get("x-request-id") === nf.body.requestId,
    "The requestId in the body matches the X-Request-Id header"
  );

  // Auth
  const noTok = await http(`${API}/auth/me`);
  t.ok(
    noTok.status === 401 && isEnvelopeError(noTok.body),
    "no token → 401 envelope",
    noTok.body
  );

  const me = await http(`${API}/auth/me`, { headers: auth });
  t.ok(
    me.status === 200 &&
      me.body?.success === true &&
      me.body?.data?.id === user.id,
    "valid token → 200 {success:true,data}",
    me.body
  );
  t.ok(
    !("password" in (me.body?.data ?? {})),
    "response /auth/me does not contain password"
  );

  const revoked = fx.tokenFor(user);
  await sessionRepository.blacklistAccessToken(
    verifyAccessToken(revoked).jti!,
    60
  );
  const rev = await http(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${revoked}` },
  });
  t.ok(
    rev.status === 401 && rev.body?.code === "TOKEN_REVOKED",
    "revoked token → 401 code TOKEN_REVOKED",
    rev.body
  );

  // Danh sách có phân trang
  const jobs = await http(`${API}/jobs?limit=2`);
  t.ok(
    jobs.status === 200 &&
      Array.isArray(jobs.body?.data) &&
      typeof jobs.body?.pagination?.total === "number",
    "GET /jobs → 200 {data[], pagination{total}}",
    jobs.body
  );

  // Lỗi của client phải là 4xx, không bao giờ 5xx
  const badId = await http(`${API}/jobs/not-a-uuid`);
  t.ok(
    badId.status >= 400 && badId.status < 500 && isEnvelopeError(badId.body),
    `Incorrect ID format → 4xx (accepted ${badId.status})`
  );

  const badJson = await http(`${API}/groups`, {
    method: "POST",
    headers: json,
    body: "{bad",
  });
  t.ok(
    badJson.status === 400 &&
      /Malformed JSON/i.test(badJson.body?.message ?? ""),
    "Invalid JSON syntax → 400 'Malformed JSON body' (not 500)",
    badJson.body
  );

  const invalid = await http(`${API}/groups`, {
    method: "POST",
    headers: { ...json, ...auth },
    body: "{}",
  });
  t.ok(
    invalid.status >= 400 &&
      invalid.status < 500 &&
      isEnvelopeError(invalid.body) &&
      invalid.body.errors.length > 0 &&
      "field" in invalid.body.errors[0],
    "Invalid body schema → 4xx with errors[{field,message}]",
    invalid.body
  );

  // CORS: header mới phải qua được preflight
  const origin = process.env.CLIENT_URL!;
  const pre = await http(`${API}/groups`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers":
        "idempotency-key,x-request-id,authorization,content-type",
    },
  });
  const allow = (
    pre.headers.get("access-control-allow-headers") ?? ""
  ).toLowerCase();
  t.ok(
    pre.status < 300 &&
      allow.includes("idempotency-key") &&
      allow.includes("x-request-id"),
    "preflight allows Idempotency-Key and X-Request-Id",
    allow
  );
  const expose = (
    pre.headers.get("access-control-expose-headers") ?? ""
  ).toLowerCase();
  t.ok(
    expose.includes("idempotency-replayed"),
    "expose header Idempotency-Replayed",
    expose
  );

  // /metrics
  const m1 = await http("/metrics");
  t.ok(
    m1.status === 200 && String(m1.body).includes("jobportal_"),
    "/metrics is exposed (when METRICS_TOKEN is not set) and includes metrics with the prefix `jobportal_*`"
  );

  const slug = `verify-slug-${runId}`;
  await http(`${API}/blogs/${slug}`);
  const stray = `/zzz-${runId}`;
  await http(stray);
  const m2 = String((await http("/metrics")).body);
  t.ok(
    !m2.includes(slug),
    "The `blog` slug does NOT appear in the label (use the route pattern `/:slug` instead)"
  );
  t.ok(
    m2.includes(`${API}/blogs/:slug`),
    "label uses route pattern /api/v1/blogs/:slug"
  );
  t.ok(
    !m2.includes(stray) && m2.includes("__unmatched__"),
    "URL does not match any route and is grouped under __unmatched__ (to prevent cardinality explosion)"
  );

  process.env.METRICS_TOKEN = "verify-metrics-token";
  try {
    const denied = await http("/metrics");
    const allowed = await http("/metrics", {
      headers: { Authorization: "Bearer verify-metrics-token" },
    });
    t.ok(denied.status === 401, "METRICS_TOKEN present: header missing → 401");
    t.ok(allowed.status === 200, "METRICS_TOKEN present: correct Bearer → 200");
  } finally {
    process.env.METRICS_TOKEN = "";
  }
};
