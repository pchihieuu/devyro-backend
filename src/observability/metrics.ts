// import { Counter, Gauge, Histogram } from "prom-client";

// /**
//  * Metric bổ sung cho HTTP metrics của express-prom-bundle (chỉ đo request
//  * duration/count theo route). Đăng ký vào registry mặc định nên tự xuất hiện
//  * ở GET /metrics.
//  *
//  * Quy ước label (chốt để tránh cardinality bùng nổ):
//  *  - DB:    `operation` (SELECT/INSERT/UPDATE/DELETE/WITH/TRANSACTION/OTHER)
//  *           — KHÔNG gắn entity/SQL vào label; chi tiết từng query nằm ở log
//  *           slow-query (kèm requestId).
//  *  - HTTP↔DB: `route` = route pattern (vd /api/v1/jobs/:id), không phải URL thật.
//  *  - Redis: `command` + `prefix` (2 segment đầu của key, vd `auth:userCache`).
//  */
// const P = "jobportal_";

// export const dbQueryDuration = new Histogram({
//   name: `${P}db_query_duration_seconds`,
//   help: "Thời gian thực thi mỗi câu SQL (giây)",
//   labelNames: ["operation"] as const,
//   buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
// });

// export const dbQueryErrors = new Counter({
//   name: `${P}db_query_errors_total`,
//   help: "Số câu SQL lỗi",
//   labelNames: ["operation"] as const,
// });

// export const dbSlowQueries = new Counter({
//   name: `${P}db_slow_queries_total`,
//   help: "Số câu SQL vượt ngưỡng DB_SLOW_QUERY_MS",
//   labelNames: ["operation"] as const,
// });

// export const dbQueriesPerRequest = new Histogram({
//   name: `${P}db_queries_per_request`,
//   help: "Số câu SQL chạy trong 1 HTTP request (theo route)",
//   labelNames: ["route"] as const,
//   buckets: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144],
// });

// export const nPlusOneSuspects = new Counter({
//   name: `${P}n_plus_one_suspects_total`,
//   help: "Số request có 1 câu SQL (cùng dạng) lặp lại ≥ N_PLUS_ONE_THRESHOLD lần",
//   labelNames: ["route"] as const,
// });

// export const redisCommandDuration = new Histogram({
//   name: `${P}redis_command_duration_seconds`,
//   help: "Thời gian round-trip mỗi lệnh Redis (giây)",
//   labelNames: ["command"] as const,
//   buckets: [0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
// });

// export const redisCommandErrors = new Counter({
//   name: `${P}redis_command_errors_total`,
//   help: "Số lệnh Redis lỗi",
//   labelNames: ["command"] as const,
// });

// export const redisCacheOps = new Counter({
//   name: `${P}redis_cache_operations_total`,
//   help: "Redis GET/EXISTS theo kết quả hit/miss, nhóm theo prefix của key",
//   labelNames: ["prefix", "result"] as const,
// });

// export const outboxEvents = new Counter({
//   name: `${P}outbox_events_total`,
//   help: "Kết quả xử lý outbox: published | retry | dead",
//   labelNames: ["topic", "result"] as const,
// });

// /**
//  * Gauge backlog outbox — đo tại thời điểm scrape (collect). Lỗi DB khi scrape
//  * không được làm hỏng toàn bộ /metrics nên nuốt lỗi và giữ giá trị cũ.
//  */
// export const registerOutboxGauges = (counters: {
//   pending: () => Promise<number>;
//   dead: () => Promise<number>;
// }): void => {
//   new Gauge({
//     name: `${P}outbox_pending`,
//     help: "Số event outbox đang chờ publish",
//     async collect() {
//       try {
//         this.set(await counters.pending());
//       } catch {
//         /* giữ giá trị cũ */
//       }
//     },
//   });
//   new Gauge({
//     name: `${P}outbox_dead`,
//     help: "Số event outbox đã hết lượt retry (cần xử lý tay)",
//     async collect() {
//       try {
//         this.set(await counters.dead());
//       } catch {
//         /* giữ giá trị cũ */
//       }
//     },
//   });
// };


import { Counter, Gauge, Histogram } from "prom-client";

/**
 * Metric bổ sung cho HTTP metrics của express-prom-bundle (chỉ đo request
 * duration/count theo route). Đăng ký vào registry mặc định nên tự xuất hiện
 * ở GET /metrics.
 *
 * Quy ước label (chốt để tránh cardinality bùng nổ):
 *  - DB:    `operation` (SELECT/INSERT/UPDATE/DELETE/WITH/TRANSACTION/OTHER)
 *           — KHÔNG gắn entity/SQL vào label; chi tiết từng query nằm ở log
 *           slow-query (kèm requestId).
 *  - HTTP↔DB: `route` = route pattern (vd /api/v1/jobs/:id), không phải URL thật.
 *  - Redis: `command` + `prefix` (2 segment đầu của key, vd `auth:userCache`).
 */
const P = "jobportal_";

export const dbQueryDuration = new Histogram({
  name: `${P}db_query_duration_seconds`,
  help: "Thời gian thực thi mỗi câu SQL (giây)",
  labelNames: ["operation"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
});

export const dbQueryErrors = new Counter({
  name: `${P}db_query_errors_total`,
  help: "Số câu SQL lỗi",
  labelNames: ["operation"] as const,
});

export const dbSlowQueries = new Counter({
  name: `${P}db_slow_queries_total`,
  help: "Số câu SQL vượt ngưỡng DB_SLOW_QUERY_MS",
  labelNames: ["operation"] as const,
});

export const dbQueriesPerRequest = new Histogram({
  name: `${P}db_queries_per_request`,
  help: "Số câu SQL chạy trong 1 HTTP request (theo route)",
  labelNames: ["route"] as const,
  buckets: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144],
});

export const nPlusOneSuspects = new Counter({
  name: `${P}n_plus_one_suspects_total`,
  help: "Số request có 1 câu SQL (cùng dạng) lặp lại ≥ N_PLUS_ONE_THRESHOLD lần",
  labelNames: ["route"] as const,
});

export const redisCommandDuration = new Histogram({
  name: `${P}redis_command_duration_seconds`,
  help: "Thời gian round-trip mỗi lệnh Redis (giây)",
  labelNames: ["command"] as const,
  buckets: [0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
});

export const redisCommandErrors = new Counter({
  name: `${P}redis_command_errors_total`,
  help: "Số lệnh Redis lỗi",
  labelNames: ["command"] as const,
});

export const redisCacheOps = new Counter({
  name: `${P}redis_cache_operations_total`,
  help: "Redis GET/EXISTS theo kết quả hit/miss, nhóm theo prefix của key",
  labelNames: ["prefix", "result"] as const,
});

/** Gọi dịch vụ ngoài (Cloudinary, SMTP, Gemini). `service` là chuỗi cố định, không phải URL. */
export const externalCallDuration = new Histogram({
  name: `${P}external_call_duration_seconds`,
  help: "Thời gian gọi dịch vụ ngoài (giây) theo kết quả ok | error | timeout",
  labelNames: ["service", "result"] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
});

export const mqMessages = new Counter({
  name: `${P}mq_messages_total`,
  help: "Kết quả xử lý message RabbitMQ: ok | retry | dead (đã chuyển DLQ)",
  labelNames: ["queue", "result"] as const,
});

export const mqHandlerDuration = new Histogram({
  name: `${P}mq_handler_duration_seconds`,
  help: "Thời gian consumer xử lý 1 message (giây)",
  labelNames: ["queue"] as const,
  buckets: [0.005, 0.025, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const mqPublish = new Counter({
  name: `${P}mq_publish_total`,
  help: "Kết quả publish RabbitMQ: ok | backpressure | not_ready | error",
  labelNames: ["result"] as const,
});

export const authEvents = new Counter({
  name: `${P}auth_events_total`,
  help: "Sự kiện xác thực: register | login_success | login_failed | refresh_failed",
  labelNames: ["event"] as const,
});

export const wsConnections = new Gauge({
  name: `${P}ws_connections`,
  help: "Số kết nối Socket.IO đang mở",
});

export const httpInFlight = new Gauge({
  name: `${P}http_requests_in_flight`,
  help: "Số HTTP request đang được xử lý",
});

new Gauge({
  name: `${P}app_info`,
  help: "Thông tin build (luôn = 1)",
  labelNames: ["version", "node", "env"] as const,
}).set(
  {
    version: process.env.SENTRY_RELEASE || process.env.npm_package_version || "unknown",
    node: process.version,
    env: process.env.NODE_ENV || "development",
  },
  1
);

export const outboxEvents = new Counter({
  name: `${P}outbox_events_total`,
  help: "Kết quả xử lý outbox: published | retry | dead",
  labelNames: ["topic", "result"] as const,
});

/**
 * Gauge backlog outbox — đo tại thời điểm scrape (collect). Lỗi DB khi scrape
 * không được làm hỏng toàn bộ /metrics nên nuốt lỗi và giữ giá trị cũ.
 */
export const registerOutboxGauges = (counters: {
  pending: () => Promise<number>;
  dead: () => Promise<number>;
}): void => {
  new Gauge({
    name: `${P}outbox_pending`,
    help: "Số event outbox đang chờ publish",
    async collect() {
      try {
        this.set(await counters.pending());
      } catch {
        /* giữ giá trị cũ */
      }
    },
  });
  new Gauge({
    name: `${P}outbox_dead`,
    help: "Số event outbox đã hết lượt retry (cần xử lý tay)",
    async collect() {
      try {
        this.set(await counters.dead());
      } catch {
        /* giữ giá trị cũ */
      }
    },
  });
};
