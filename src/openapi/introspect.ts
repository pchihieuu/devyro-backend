import { Router } from "express";
import { ZodType } from "zod";
import { apiRouters } from "../routes";
import { ADMIN_ONLY, AUTH_MODE, RATE_LIMITER } from "./markers";
import { VALIDATION_SCHEMA } from "../middlewares/validation.middleware";
import { IDEMPOTENT } from "../middlewares/idempotency.middleware";

/**
 * Đọc router Express THẬT (router.stack) để suy ra method, path, auth,
 * validator, idempotency, rate-limit, multipart cho từng endpoint. Nhờ đó
 * những gì liên quan tới REQUEST không bao giờ lệch khỏi code đang chạy.
 */

export type AuthMode = "none" | "optional" | "required";

export interface RouteInfo {
  method: "get" | "post" | "put" | "patch" | "delete";
  /** Express-style, tương đối API prefix: "/jobs/:id" */
  path: string;
  tag: string;
  auth: AuthMode;
  adminOnly: boolean;
  idempotent: boolean;
  multipart: boolean;
  rateLimited: string[];
  requestSchema?: ZodType;
}

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

interface StackLayer {
  name?: string;
  handle: unknown;
  method?: string;
  route?: { path: string; stack: StackLayer[] };
}

const analyse = (
  handlers: unknown[]
): Omit<RouteInfo, "method" | "path" | "tag"> => {
  const info: Omit<RouteInfo, "method" | "path" | "tag"> = {
    auth: "none",
    adminOnly: false,
    idempotent: false,
    multipart: false,
    rateLimited: [],
  };

  for (const h of handlers) {
    if (typeof h !== "function") continue;
    const tagged = h as unknown as Record<string, unknown>;

    // Nhận diện bằng marker (Symbol.for), KHÔNG so sánh identity hàm — xem markers.ts.
    const mode = tagged[AUTH_MODE];
    if (mode === "required") info.auth = "required";
    else if (mode === "optional" && info.auth === "none") info.auth = "optional";
    if (tagged[ADMIN_ONLY]) info.adminOnly = true;
    if (typeof tagged[RATE_LIMITER] === "string") {
      info.rateLimited.push(tagged[RATE_LIMITER] as string);
    }

    if (tagged[IDEMPOTENT]) info.idempotent = true;
    if (tagged[VALIDATION_SCHEMA]) {
      info.requestSchema = tagged[VALIDATION_SCHEMA] as ZodType;
    }
    if (h.name === "multerMiddleware") info.multipart = true;
  }
  return info;
};

const walkRouter = (router: Router, base: string, tag: string): RouteInfo[] => {
  const result: RouteInfo[] = [];
  // router.use(protect) đứng trước route nào thì áp dụng cho route đó.
  const inherited: unknown[] = [];

  for (const layer of (router as unknown as { stack: StackLayer[] }).stack) {
    if (!layer.route) {
      inherited.push(layer.handle);
      continue;
    }
    const routePath = layer.route.path === "/" ? "" : layer.route.path;
    for (const method of METHODS) {
      const own = layer.route.stack
        .filter((l) => l.method === undefined || l.method === method)
        .filter((l) => layer.route!.stack.some((x) => x.method === method))
        .map((l) => l.handle);
      if (own.length === 0) continue;
      result.push({
        method,
        path: `${base}${routePath}`,
        tag,
        ...analyse([...inherited, ...own]),
      });
    }
  }
  return result;
};

export const introspectRoutes = (): RouteInfo[] =>
  apiRouters.flatMap(({ base, router, tag }) => walkRouter(router, base, tag));
