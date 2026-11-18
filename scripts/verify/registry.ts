import type { SuiteFn } from "./types";

export interface SuiteMeta {
  id: string;
  title: string;
  /** Criteria (matching CHANGES.md / docs/VERIFY.md) that this suite demonstrates. */
  covers: string[];
  load: () => SuiteFn;
}

export const SUITES: SuiteMeta[] = [
  {
    id: "schema",
    title: "Schema, migration, index",
    covers: ["Clean migration execution", "Entities match the database (no drift)", "Required indexes exist"],
    load: () => require("./suites/01-schema").run,
  },
  {
    id: "http",
    title: "HTTP: ApiResponse, lỗi, CORS, /metrics",
    covers: ["Unified envelope response", "Correct error types (404/401/400/4xx)", "CORS for Idempotency-Key/X-Request-Id", "/metrics + METRICS_TOKEN", "Label route doesn't expand (slug/unmatched)"],
    load: () => require("./suites/02-http").run,
  },
  {
    id: "errors",
    title: "DB error mapping → HTTP",
    covers: ["unique→409", "invalid UUID→400", "statement_timeout→503", "strange error→500 no details revealed"],
    load: () => require("./suites/03-errors").run,
  },
  {
    id: "auth",
    title: "Authentication: protect / optionalAuth / token revocation",
    covers: ["optionalAuth respects blacklist & logout-all", "Infrastructure errors are not swallowed as 401", "Password hash is not loaded"],
    load: () => require("./suites/04-auth").run,
  },
  {
    id: "group-chat",
    title: "Group chat: repository/service, race, search",
    covers: ["createGroup transactional", "Race accept/remove member", "Search (escape wildcard)", "replyTo.senderName", "lastMessage is correct when deleting", "NULLS LAST"],
    load: () => require("./suites/05-group-chat").run,
  },
  {
    id: "outbox",
    title: "Transactional outbox + relay",
    covers: ["Message + event committed together", "A rollback does not leave behind any orphaned events.", "Retry + backoff", "Dead-letter", "Many relays do not allow for duplicates", "Crash recovery (lease)"],
    load: () => require("./suites/06-outbox").run,
  },
  {
    id: "idempotency",
    title: "Idempotency-Key",
    covers: ["The replay returns the correct response, and the handler runs once.", "Other payload → 422", " simultaneous → 409", "4xx error releases key", "No header sent = old behavior"],
    load: () => require("./suites/07-idempotency").run,
  },
  {
    id: "observability",
    title: "Metrics, slow query, N+1, Redis hit/miss",
    covers: ["SQL Time Histogram", "Log slow queries (without exposing parameters)", "Detect N+1", "Redis hit/miss by prefix"],
    load: () => require("./suites/08-observability").run,
  },
  {
    id: "analytics",
    title: "Analytics (aggregate queries)",
    covers: ["Accurate data & trends", "Half-open interval", "Soft-delete has been removed", "Employer only sees their own data", "No N+1", "No drift after migration"],
    load: () => require("./suites/09-analytics").run,
  },
  {
    id: "blog-tags",
    title: "Bulk blog tagging",
    covers: ["Existing tag = 1 query", "Dedupe by slug", "Create simultaneously without errors"],
    load: () => require("./suites/10-blog-tags").run,
  },
  {
    id: "job-search",
    title: "Job search: skills overlap, LIKE escape",
    covers: ["Migration lowercase skills", "&& GIN index can be used", "Escape % and _"],
    load: () => require("./suites/11-job-search").run,
  },
  {
    id: "mq-reconnect",
    title: "RabbitMQ: auto-reconnect (mock amqplib)",
    covers: ["Continue retrying after initial failure", "Hook re-registration of consumer runs once", "Skip events from old connection", "Recreate publish channel", "close() stops reconnect"],
    load: () => require("./suites/13-mq-reconnect").run,
  },
  {
    id: "timeouts",
    title: "External service timeouts (Cloudinary, RabbitMQ)",
    covers: ["withTimeout terminates the wait and returns a 502", "No timer leaks"],
    load: () => require("./suites/12-timeouts").run,
  },
];
