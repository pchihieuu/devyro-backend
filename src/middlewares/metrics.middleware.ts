import { Express, Request, Response } from "express";
import promBundle from "express-prom-bundle";
import { register, collectDefaultMetrics } from "prom-client";

export function setupMetrics(app: Express): void {
  collectDefaultMetrics({ prefix: "jobportal_" });

  const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    includeStatusCode: true,
    normalizePath: [
      [/\/api\/v1\/jobs\/\d+/, "/api/v1/jobs/:id"],
      [/\/api\/v1\/users\/\d+/, "/api/v1/users/:id"],
      [/\/api\/v1\/applications\/\d+/, "/api/v1/applications/:id"],
    ],
    autoregister: false,
  });

  app.use(metricsMiddleware as any);

  app.get("/metrics", async (req: Request, res: Response) => {
    try {
      res.set("Content-Type", register.contentType);
      res.end(await register.metrics());
    } catch (err) {
      res.status(500).end(err);
    }
  });

  console.log("Prometheus metrics enabled at GET /metrics");
}