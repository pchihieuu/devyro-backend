import { z, ZodType } from "zod";
import { API_PREFIX } from "../constants/routes";
import { Converted, toOpenApi } from "./json-schema";
import { introspectRoutes, RouteInfo } from "./introspect";
import { OpCatalog, OpSpec } from "./types";
import { apiError, paginationMeta } from "./schemas/common";
import { catalog } from "./catalog";

type Json = Record<string, any>;

const STATUS_TEXT: Record<number, string> = {
  400: "Submitted data is invalid (field-level errors in `errors`)",
  401: "Not authenticated / access token expired or revoked",
  403: "Insufficient permissions",
  404: "Resource not found",
  409: "Conflict (already exists / request with same Idempotency-Key is running)",
  422: "Idempotency-Key already used with different payload",
  429: "Rate limit exceeded",
  500: "Server error",
  503: "Service temporarily unavailable",
};

const toOperationId = (method: string, path: string): string => {
  const parts = path
    .split("/")
    .filter(Boolean)
    .map((seg) =>
      seg.startsWith(":")
        ? "By" + seg.slice(1).replace(/^./, (c) => c.toUpperCase())
        : seg.replace(/(^|[-_])(\w)/g, (_, __, c: string) => c.toUpperCase())
    );
  return method + parts.join("");
};

const openApiPath = (expressPath: string): string =>
  expressPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");

export interface BuildResult {
  document: Json;
  problems: string[];
}

export const buildOpenApiDocument = (
  opts: {
    serverUrl?: string;
    version?: string;
  } = {}
): BuildResult => {
  const problems: string[] = [];
  const components: Record<string, Json> = {};

  const absorb = (c: Converted): Json => {
    for (const [name, def] of Object.entries(c.definitions)) {
      components[name] ??= def;
    }
    return c.schema;
  };
  const convert = (schema: ZodType, io: "input" | "output"): Json =>
    absorb(toOpenApi(schema, io));

  // Schema gắn id mà đứng ở GỐC thì Zod không đưa vào definitions → đăng ký tay.
  components.ApiError = absorb(toOpenApi(apiError, "output"));
  components.PaginationMeta = absorb(toOpenApi(paginationMeta, "output"));

  const routes = introspectRoutes();
  const seen = new Set<string>();
  const paths: Record<string, Json> = {};
  const tagSet = new Set<string>();

  const errorRef = { $ref: "#/components/schemas/ApiError" };
  const errorResponse = (status: number, description?: string): Json => ({
    description: description ?? STATUS_TEXT[status] ?? "Lỗi",
    content: { "application/json": { schema: errorRef } },
  });

  const successEnvelope = (spec: OpSpec): Json => {
    const shape: Record<string, ZodType> = {
      success: z.literal(true),
      message: z.string().optional(),
    };
    if (spec.data) {
      shape.data = spec.paginated ? z.array(spec.data) : spec.data;
    }
    if (spec.paginated) shape.pagination = paginationMeta;
    if (spec.meta) shape.meta = spec.meta;
    Object.assign(shape, spec.extra);
    return convert(z.object(shape), "output");
  };

  for (const route of routes) {
    const key = `${route.method.toUpperCase()} ${route.path}`;
    seen.add(key);
    const spec = catalog[key];
    if (!spec) {
      problems.push(`Missing OpenAPI description for route: ${key}`);
      continue;
    }
    tagSet.add(spec.tag ?? route.tag);
    const url = openApiPath(route.path);
    (paths[url] ??= {})[route.method] = buildOperation(route, spec);
  }

  for (const key of Object.keys(catalog)) {
    if (!seen.has(key)) {
      problems.push(`Catalog has description for non-existent route: ${key}`);
    }
  }

  function buildOperation(route: RouteInfo, spec: OpSpec): Json {
    const parameters: Json[] = [];
    let requestBody: Json | undefined;

    // params / query / body: suy ra từ validator Zod thật
    const shape = (
      route.requestSchema as unknown as
        | { shape?: Record<string, ZodType> }
        | undefined
    )?.shape;
    const documentedPathParams = new Set<string>();

    const pushProps = (location: "path" | "query", schema?: ZodType): void => {
      if (!schema) return;
      const json = convert(schema, "input");
      const required = new Set<string>(json.required ?? []);
      for (const [name, prop] of Object.entries<Json>(json.properties ?? {})) {
        const { description, ...rest } = prop;
        parameters.push({
          name,
          in: location,
          required: location === "path" ? true : required.has(name),
          ...(description && { description }),
          schema: rest,
        });
        if (location === "path") documentedPathParams.add(name);
      }
    };
    pushProps("path", shape?.params);
    pushProps("query", shape?.query);

    // Path param không có trong validator (vd /auth/sessions/:tokenId).
    for (const m of route.path.matchAll(/:([A-Za-z0-9_]+)/g)) {
      if (!documentedPathParams.has(m[1])) {
        parameters.push({
          name: m[1],
          in: "path",
          required: true,
          schema: { type: "string" },
        });
      }
    }

    if (shape?.body) {
      const json = convert(shape.body, "input");
      requestBody = {
        required: (json.required?.length ?? 0) > 0 || json.type !== "object",
        content: { "application/json": { schema: json } },
      };
    }
    if (spec.multipart) {
      requestBody = {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: [spec.multipart.field],
              properties: {
                [spec.multipart.field]: {
                  type: "string",
                  format: "binary",
                  description:
                    spec.multipart.description ?? "Maximum 5MB — jpeg/png/pdf",
                },
              },
            },
          },
        },
      };
    }
    if (route.idempotent) {
      parameters.push({
        name: "Idempotency-Key",
        in: "header",
        required: false,
        description:
          "Optional. Generate a UUID for each submission and reuse it during retries to prevent duplicate creation. For replayed requests, include the header `Idempotency-Replayed: true`.",
        schema: { type: "string", minLength: 8, maxLength: 128 },
      });
    }

    const successStatus = spec.status ?? 200;
    const successHeaders: Json = {
      "X-Request-Id": {
        description: "Correlation id",
        schema: { type: "string" },
      },
    };
    if (route.idempotent) {
      successHeaders["Idempotency-Replayed"] = {
        description: "true if this is a replayed response",
        schema: { type: "string", enum: ["true"] },
      };
    }
    if (spec.setsRefreshCookie) {
      successHeaders["Set-Cookie"] = {
        description: "refreshToken (httpOnly, 7 days)",
        schema: { type: "string" },
      };
    }

    const responses: Json = {
      [successStatus]: {
        description: "Success",
        headers: successHeaders,
        content: { "application/json": { schema: successEnvelope(spec) } },
      },
    };

    const hasRequest = parameters.some((p) => p.in !== "header") || requestBody;
    if (hasRequest) responses[400] = errorResponse(400);
    if (route.auth === "required" || spec.usesRefreshCookie)
      responses[401] = errorResponse(401);
    if (route.adminOnly || spec.roles) {
      responses[403] = errorResponse(
        403,
        route.adminOnly ? "Admins only" : `Role only: ${spec.roles!.join(", ")}`
      );
    }
    if (route.path.includes(":")) responses[404] = errorResponse(404);
    if (route.idempotent) {
      responses[409] = errorResponse(409);
      responses[422] = errorResponse(422);
    }
    if (route.rateLimited.length > 0) responses[429] = errorResponse(429);
    for (const [status, description] of Object.entries(spec.errors ?? {})) {
      responses[status] = errorResponse(Number(status), description);
    }
    responses[500] ??= errorResponse(500);

    const security: Json[] | undefined = spec.usesRefreshCookie
      ? [{ refreshCookie: [] }]
      : route.auth === "required"
        ? [{ bearerAuth: [] }]
        : route.auth === "optional"
          ? [{}, { bearerAuth: [] }]
          : [];

    const roleNote = spec.roles ? `\n\n**Role:** ${spec.roles.join(", ")}` : "";
    const limiterNote = route.rateLimited.length
      ? `\n\n**Rate limit:** ${route.rateLimited.join(", ")}`
      : "";

    return {
      tags: [spec.tag ?? route.tag],
      operationId: toOperationId(route.method, route.path),
      summary: spec.summary,
      description:
        `${spec.description ?? ""}${roleNote}${limiterNote}`.trim() ||
        undefined,
      ...(spec.deprecated && { deprecated: true }),
      ...(parameters.length > 0 && { parameters }),
      ...(requestBody && { requestBody }),
      responses,
      security,
    };
  }

  paths["/health"] = {
    get: {
      tags: ["system"],
      operationId: "getHealth",
      summary: "Liveness check",
      security: [],
      responses: {
        200: {
          description: "Server is running",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { status: { type: "string", enum: ["ok"] } },
              },
            },
          },
        },
      },
    },
  };
  tagSet.add("system");

  const document: Json = {
    openapi: "3.0.3",
    info: {
      title: "Devyro API",
      version: opts.version ?? "1.0.0",
      description: [
        "API contract between backend and frontend. **Automatically generated** from Express router + Zod validator — no manual JSON editing.",
        "",
        "### Envelope",
        "- Success: `{ success: true, message?, data?, pagination?, meta? }`",
        "- Failure: `{ success: false, message, errors: [{ field, message }], code?, requestId? }`",
        "",
        "### FE Guidelines",
        '- Column `decimal` (salary, rating...) returns as a **string** (`"1500.00"`).',
        "- All responses include header `X-Request-Id` — sent along with error reports.",
        "- POST requests to create resources support the header `Idempotency-Key` (optional).",
        "- Realtime (Socket.IO) is not included in the OpenAPI specification.",
      ].join("\n"),
    },
    servers: [{ url: opts.serverUrl ?? API_PREFIX }],
    tags: [...tagSet].sort().map((name) => ({ name })),
    paths: Object.fromEntries(
      Object.entries(paths).sort(([a], [b]) => a.localeCompare(b))
    ),
    components: {
      schemas: Object.fromEntries(
        Object.entries(components).sort(([a], [b]) => a.localeCompare(b))
      ),
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        refreshCookie: { type: "apiKey", in: "cookie", name: "refreshToken" },
      },
    },
  };

  document.paths["/health"].servers = [{ url: "/" }];

  return { document, problems };
};
