import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

/**
 * OBSERVABILITY GAP: nothing in this codebase previously tagged a request
 * with a correlation id, so tracing one HTTP call through
 * access log -> error log -> any async side effect it kicked off (email,
 * MQ publish, AI matching) required grepping by timestamp/IP and guessing.
 *
 * - Honors an inbound `X-Request-Id` (set by a load balancer/API gateway)
 *   so a trace stays consistent across hops instead of getting a new id at
 *   every service boundary.
 * - Always echoes it back on the response so client-side error reports /
 *   support tickets can reference the exact id a person hit.
 */
export const requestId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const incoming = req.headers["x-request-id"];
  const id =
    (typeof incoming === "string" && incoming) || crypto.randomUUID();

  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
};
