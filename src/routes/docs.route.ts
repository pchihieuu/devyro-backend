import crypto from "crypto";
import express, { NextFunction, Request, Response, Router } from "express";
import { config } from "../config/env.config";
import { ROUTES } from "../constants/routes";
import { logger } from "../utils/logger";
import { getOpenApiDocument } from "../openapi";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const swaggerUiDist = require("swagger-ui-dist") as {
  getAbsoluteFSPath: () => string;
};

const router = Router();

const safeEqual = (a: string, b: string): boolean => {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

/** Basic auth tuỳ chọn (DOCS_BASIC_AUTH="user:pass") — nên bật khi mở docs ở production. */
const docsGuard = (req: Request, res: Response, next: NextFunction): void => {
  const expected = config.docs.basicAuth;
  if (!expected) return next();

  const header = req.headers.authorization ?? "";
  const provided = header.startsWith("Basic ")
    ? Buffer.from(header.slice(6), "base64").toString()
    : "";
  if (provided && safeEqual(provided, expected)) return next();

  res.setHeader("WWW-Authenticate", 'Basic realm="API docs"');
  res.status(401).send("Authentication required");
};

router.use(docsGuard);

router.get(ROUTES.DOCS.SPEC, (_req, res) => {
  const { document } = getOpenApiDocument();
  res.json(document);
});

// Không dùng script inline để không phụ thuộc CSP 'unsafe-inline'.
router.get(ROUTES.DOCS.INIT, (_req, res) => {
  res.type("application/javascript").send(`
window.ui = SwaggerUIBundle({
  url: "${ROUTES.DOCS.BASE}${ROUTES.DOCS.SPEC}",
  dom_id: "#swagger-ui",
  deepLinking: true,
  persistAuthorization: true,
  displayRequestDuration: true,
  tryItOutEnabled: true,
  presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
  layout: "StandaloneLayout",
});`);
});

router.use(
  ROUTES.DOCS.ASSETS,
  express.static(swaggerUiDist.getAbsoluteFSPath(), { index: false })
);

router.get("/", (_req, res) => {
  const a = `${ROUTES.DOCS.BASE}${ROUTES.DOCS.ASSETS}`;
  res.type("html").send(`<!doctype html>
<html lang="vi"><head><meta charset="utf-8"/>
<title>Devyro API Docs</title>
<link rel="stylesheet" href="${a}/swagger-ui.css"/>
</head><body><div id="swagger-ui"></div>
<script src="${a}/swagger-ui-bundle.js"></script>
<script src="${a}/swagger-ui-standalone-preset.js"></script>
<script src="${ROUTES.DOCS.BASE}${ROUTES.DOCS.INIT}"></script>
</body></html>`);
});

/** Log lệch giữa router và catalog ngay lúc boot (không chặn server khởi động). */
export const warnOpenApiProblems = (): void => {
  const { problems } = getOpenApiDocument();
  if (problems.length > 0) {
    logger.warn("OpenAPI document has problems", { problems });
  }
};

export default router;
