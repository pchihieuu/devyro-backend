# Observability & Runbook

Tài liệu vận hành cho metrics (Prometheus), dashboard (Grafana), cảnh báo (Alertmanager → Telegram), tracing (OpenTelemetry → Tempo) và error tracking (Sentry).

## 1. Kiến trúc

```
                 ┌──────────── /metrics ───────────┐
 API (Express) ──┤                                  ├─► Prometheus ─► Alertmanager ─► Telegram
   │  │          └─ blackbox probe /health ─────────┘        │
   │  └─ OTLP (traces) ─► OTel Collector ─► Tempo             └─► Grafana (4 dashboard + Tempo + Alertmanager)
   │                         └─ spanmetrics ─► Prometheus
   └─ lỗi 5xx / unhandled ─► Sentry   (tag requestId + traceId)
Log (winston) luôn kèm requestId + traceId + spanId.
```

Mọi correlation đi qua **requestId** (header `X-Request-Id`) và **traceId**:
log → copy `traceId` → Grafana _Explore → Tempo_; Sentry event có tag `traceId`/`requestId`.

## 2. Chạy local

```bash
make monitoring            # api + db + redis + rabbitmq + toàn bộ stack giám sát (tự bật OTEL)
```

| Thành phần            | URL                                           |
| --------------------- | --------------------------------------------- |
| Swagger UI            | http://localhost:5000/docs                    |
| Grafana (admin/admin) | http://localhost:3000 → folder **Job Portal** |
| Prometheus            | http://localhost:9090                         |
| Alertmanager          | http://localhost:9093                         |

Telegram: tạo bot với @BotFather → ghi token vào `alertmanager/secrets/telegram_bot_token` (1 dòng, file đã được `.gitignore`), sửa `chat_id` trong `alertmanager/alertmanager.yml`, rồi `docker compose restart alertmanager`.
Gửi thử: `docker exec jobportal-alertmanager amtool alert add test severity=critical area=http --annotation=summary="test" --alertmanager.url=http://localhost:9093`.

Kiểm tra cấu hình (không cần chạy stack): `make alerts-test` (promtool check + unit test rule).

## 3. Dashboard

| Dashboard (uid)                 | Dùng để                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| **API Overview** (`jp-api`)     | SLO (availability, burn rate), RPS, p50/p95/p99, lỗi theo route, bảng route chậm/lỗi, auth events |
| **Data stores** (`jp-data`)     | Postgres (latency theo operation, N+1, slow query), Redis (latency, hit ratio), dịch vụ ngoài     |
| **Async** (`jp-async`)          | RabbitMQ (kết nối, retry/dead, DLQ), Outbox (pending/dead), WebSocket                             |
| **Node runtime** (`jp-runtime`) | CPU, RSS/heap, event loop lag, GC, handles, uptime/restart                                        |

JSON nằm ở `grafana/dashboards/`, được provision tự động (`allowUiUpdates: false` — sửa trong UI sẽ không lưu; sửa JSON rồi commit).

## 4. SLO

| SLI               | Mục tiêu | Alert                                                                                             |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------- |
| Request không 5xx | 99.5%    | `SloErrorBudgetFastBurn` (14.4x, 1h+5m, critical), `SloErrorBudgetSlowBurn` (6x, 6h+30m, warning) |
| Request < 500ms   | 95%      | `SloLatencyDegraded`                                                                              |

`/metrics`, `/health`, `/docs` được loại khỏi các SLI này.

## 5. Phân tuyến cảnh báo

| severity   | Đi đâu                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `critical` | Telegram ngay (lặp lại mỗi 1h)                                                                                                       |
| `warning`  | Telegram (gom nhóm, lặp lại mỗi 4h)                                                                                                  |
| `info`     | Chỉ hiện ở Grafana, **không** gửi                                                                                                    |
| `Watchdog` | Luôn bắn — dùng làm heartbeat; nối tới dịch vụ dead-man's-switch (vd healthchecks.io) nếu muốn biết khi chính pipeline cảnh báo chết |

`ApiDown` ức chế các alert phụ thuộc để tránh bão thông báo.

## 6. Tracing (OpenTelemetry)

- Bật bằng `OTEL_EXPORTER_OTLP_ENDPOINT`. Span tự động: HTTP, route Express, từng câu SQL (pg), lệnh Redis, **RabbitMQ publish/consume** (trace đi từ API sang worker), Socket.IO.
- Lấy mẫu mặc định: production 10%, dev 100% (`OTEL_TRACES_SAMPLER_ARG`).
- Tìm trace lỗi trong Tempo: `{ resource.service.name = "job-portal-backend" && status = error }`; chậm: `{ duration > 2s }`.
- Collector sinh thêm metric RED từ span (`traces_spanmetrics_*`, cổng 8889).

## 7. Sentry

- Chỉ gửi lỗi 5xx / lỗi không lường trước (4xx nghiệp vụ không gửi). Header `Authorization`, cookie, body bị xoá trước khi gửi.
- Tag `requestId`, `traceId` → từ Sentry nhảy sang log/Tempo.
- Khuyến nghị: bật _Alert rule_ trong Sentry cho "issue mới" + "tăng đột biến" và nối Telegram/Slack; Sentry không thay thế Prometheus alert (nó không thấy lỗi "im lặng" như outbox kẹt).

## 8. Triển khai production (Render + Supabase + CloudAMQP)

Prometheus kéo (pull) `/metrics` nên cần một nơi chạy 24/7:

1. **Khuyến nghị:** Grafana Cloud (free tier). Chạy **Grafana Alloy** (VM nhỏ/Docker) scrape `https://<api>/metrics` với `authorization: Bearer $METRICS_TOKEN` rồi `remote_write`. Import 4 dashboard JSON; nạp `prometheus/rules/*.yml` làm rule (Mimir ruler) và cấu hình contact point Telegram.
2. Traces: đặt `OTEL_EXPORTER_OTLP_ENDPOINT` (+ `OTEL_EXPORTER_OTLP_HEADERS`) trỏ thẳng tới Grafana Cloud OTLP — không cần collector/Tempo tự host.
3. **Bắt buộc ở production:** đặt `METRICS_TOKEN`; không bật `/docs` hoặc bật kèm `DOCS_BASIC_AUTH`.
4. Đổi `external_labels.env` thành `production`; chỉnh ngưỡng `MemoryNearLimit` theo RAM thật.
5. Nếu dùng free tier Render (instance ngủ): `ApiDown`/`HttpTrafficDropped` sẽ nhiễu — dùng gói luôn bật cho production.
6. Exporter Postgres/Redis/RabbitMQ chỉ có ý nghĩa khi bạn tự host; với Supabase/CloudAMQP dùng dashboard của nhà cung cấp và bỏ các rule `pg_*`, `redis_*`, `rabbitmq_*` (alert sẽ không bao giờ bắn vì không có series).

## 9. Catalog metric tự định nghĩa

| Metric                                                       | Loại              | Label                     | Ý nghĩa                                                     |
| ------------------------------------------------------------ | ----------------- | ------------------------- | ----------------------------------------------------------- | ------------- | ------------ | --------------- |
| `http_request_duration_seconds`                              | histogram         | `method,path,status_code` | RED của API (`path` = route pattern, 404 → `__unmatched__`) |
| `jobportal_http_requests_in_flight`                          | gauge             | –                         | request đang xử lý                                          |
| `jobportal_db_query_duration_seconds`                        | histogram         | `operation`               | thời gian mỗi câu SQL                                       |
| `jobportal_db_query_errors_total` / `_slow_queries_total`    | counter           | `operation` / –           | lỗi / chậm                                                  |
| `jobportal_db_queries_per_request`                           | histogram         | `route`                   | số SQL mỗi request                                          |
| `jobportal_n_plus_one_suspects_total`                        | counter           | `route`                   | nghi N+1                                                    |
| `jobportal_redis_command_duration_seconds` / `_errors_total` | histogram/counter | `command`                 | lệnh Redis                                                  |
| `jobportal_redis_cache_operations_total`                     | counter           | `prefix,result`           | hit/miss cache                                              |
| `jobportal_external_call_duration_seconds`                   | histogram         | `service,result`          | Cloudinary, SMTP… (`ok                                      | error         | timeout`)    |
| `jobportal_mq_messages_total`                                | counter           | `queue,result`            | `ok                                                         | retry         | dead`        |
| `jobportal_mq_handler_duration_seconds`                      | histogram         | `queue`                   | thời gian consumer                                          |
| `jobportal_mq_publish_total`                                 | counter           | `result`                  | `ok                                                         | backpressure  | not_ready    | error`          |
| `jobportal_mq_connected`                                     | gauge             | –                         | 1 = đang kết nối                                            |
| `jobportal_outbox_pending` / `_dead` / `_events_total`       | gauge/counter     | `topic,result`            | outbox relay                                                |
| `jobportal_auth_events_total`                                | counter           | `event`                   | `register                                                   | login_success | login_failed | refresh_failed` |
| `jobportal_ws_connections`                                   | gauge             | –                         | kết nối Socket.IO                                           |
| `jobportal_app_info`                                         | gauge             | `version,node,env`        | build info                                                  |

Metric mặc định của Node có tiền tố `jobportal_` (vd `jobportal_nodejs_eventloop_lag_p99_seconds`).

**Quy tắc cardinality:** label chỉ được là giá trị hữu hạn (route pattern, operation, queue, service). Không bao giờ dùng userId, URL thật, email, câu SQL.

## 10. Runbook theo alert

Mỗi alert trong `prometheus/rules/alerts.rules.yml` có `runbook_url` trỏ vào mục bên dưới.

### ApiDown

**Mức:** `critical` · **Nhóm:** `availability`  
**Điều kiện:** `up{job="jobportal-api"} == 0` (for 2m)

**Kiểm tra:** Render dashboard → Events/Logs: có OOM-kill hoặc deploy lỗi? `curl https://<api>/health`. Nếu có `METRICS_TOKEN`, kiểm tra Prometheus có gửi đúng token (target báo 401).

**Xử lý:** Restart/rollback bản deploy gần nhất. Nếu OOM: xem `MemoryNearLimit`/`HeapUsageHigh` trước đó. Nếu 401 ở target: sửa credentials scrape.

### ApiHealthProbeFailing

**Mức:** `critical` · **Nhóm:** `availability`  
**Điều kiện:** `probe_success{job="blackbox-health"} == 0` (for 2m)

**Kiểm tra:** So sánh với `ApiDown`: nếu chỉ probe fail → lỗi DNS/TLS/proxy/CDN, không phải app.

**Xử lý:** Kiểm tra chứng chỉ, DNS, cấu hình Render/Cloudflare. Với free tier, instance đang ngủ: workflow keep-alive có chạy không?

### ApiRestartLoop

**Mức:** `warning` · **Nhóm:** `availability`  
**Điều kiện:** `changes(jobportal_process_start_time_seconds{job="jobportal-api"}[15m]) > 2`

**Kiểm tra:** Log + Sentry quanh thời điểm khởi động; `jobportal_process_start_time_seconds`. Thường là OOM hoặc `unhandledRejection`.

**Xử lý:** Sửa nguyên nhân crash; tạm thời tăng RAM. Kiểm tra migration chưa chạy làm boot lỗi.

### SloErrorBudgetFastBurn

**Mức:** `critical` · **Nhóm:** `slo`  
**Điều kiện:** `job:slo_errors:ratio_rate1h > (14.4 * 0.005) and job:slo_errors:ratio_rate5m > (14.4 * 0.005)` (for 2m)

**Kiểm tra:** Dashboard _API Overview_ → 'Top route lỗi 5xx'. Sentry lọc theo thời gian + `requestId`. Có deploy mới ngay trước đó không?

**Xử lý:** Rollback nếu do deploy. Nếu do dependency (DB/Redis/MQ) xem các alert cùng lúc. Đây là alert gọi người — xử lý ngay.

### SloErrorBudgetSlowBurn

**Mức:** `warning` · **Nhóm:** `slo`  
**Điều kiện:** `job:slo_errors:ratio_rate6h > (6 * 0.005) and job:slo_errors:ratio_rate30m > (6 * 0.005)` (for 15m)

**Kiểm tra:** Cùng cách điều tra như FastBurn nhưng lỗi thấp và kéo dài; hay do 1 route/1 loại dữ liệu cụ thể.

**Xử lý:** Tạo ticket, sửa trong ngày. Dùng 'Top route lỗi 5xx' để khoanh vùng.

### SloLatencyDegraded

**Mức:** `warning` · **Nhóm:** `slo`  
**Điều kiện:** `job:slo_latency_good:ratio_rate1h < 0.95 and job:http_requests:rate5m > 0.05` (for 15m)

**Kiểm tra:** _API Overview_ → p95 theo route; _Data stores_ → DB/Redis latency; Tempo: tìm trace chậm của route đó.

**Xử lý:** Tối ưu query/index (scripts/explain-analyze.sql), thêm cache, hoặc scale.

### HttpRouteHighErrorRatio

**Mức:** `warning` · **Nhóm:** `http`  
**Điều kiện:** `path:http_requests_5xx:ratio_rate5m > 0.10 and path:http_requests:rate5m > 0.05` (for 10m)

**Kiểm tra:** Biết route từ nhãn `path`. Sentry: filter `url`/`requestId`. Tempo: `{ status = error && span.http.route = "..." }`.

**Xử lý:** Sửa lỗi hoặc tạm vô hiệu hoá feature. Nhớ rằng 4xx không tính vào alert này.

### HttpLatencyP95High

**Mức:** `warning` · **Nhóm:** `http`  
**Điều kiện:** `job:http_latency_seconds:p95_5m > 1 and job:http_requests:rate5m > 0.05` (for 10m)

**Kiểm tra:** Xem route nào kéo p95 (bảng 'Top route chậm'). Đối chiếu DB p95, Redis p95, dịch vụ ngoài.

**Xử lý:** Xử lý theo thành phần chậm nhất; nếu event loop lag cao → tìm tác vụ đồng bộ nặng.

### HttpLatencyP99Critical

**Mức:** `critical` · **Nhóm:** `http`  
**Điều kiện:** `job:http_latency_seconds:p99_5m > 5 and job:http_requests:rate5m > 0.05` (for 10m)

**Kiểm tra:** Gần timeout. Kiểm tra `statement_timeout`, connection pool đầy (`PostgresConnectionsNearLimit`), Cloudinary/SMTP chậm.

**Xử lý:** Giảm tải/scale, khoanh route gây nghẽn, bật timeout cho dependency chậm.

### HttpRouteSlow

**Mức:** `warning` · **Nhóm:** `http`  
**Điều kiện:** `path:http_latency_seconds:p95_5m > 2 and path:http_requests:rate5m > 0.05` (for 15m)

**Kiểm tra:** Một route cụ thể chậm >2s p95.

**Xử lý:** Chạy EXPLAIN ANALYZE cho query của route; xem N+1 (`NPlusOneSuspected`).

### HttpTrafficDropped

**Mức:** `warning` · **Nhóm:** `http`  
**Điều kiện:** `job:http_requests:rate5m < 0.2 * avg_over_time(job:http_requests:rate5m[1h] offset 1d) and avg_over_time(job:http_requests:rate5m[1h] offset 1d) > 0.2` (for 15m)

**Kiểm tra:** Không có 5xx nhưng traffic mất: kiểm tra FE deploy, DNS/CDN, CORS (preflight bị chặn), `ApiHealthProbeFailing`.

**Xử lý:** Khôi phục đường vào API; xác nhận với FE.

### HttpInFlightHigh

**Mức:** `warning` · **Nhóm:** `http`  
**Điều kiện:** `jobportal_http_requests_in_flight > 100` (for 5m)

**Kiểm tra:** Request tồn đọng: xem DB/Redis latency và `EventLoopLagHigh`.

**Xử lý:** Giảm nguồn chậm; thêm instance; kiểm tra request treo (không timeout).

### HttpRateLimiting

**Mức:** `warning` · **Nhóm:** `security`  
**Điều kiện:** `sum(rate(http_request_duration_seconds_count{job="jobportal-api",status_code="429"}[5m])) > 5` (for 10m)

**Kiểm tra:** Xem IP/route bị 429 trong log (`morgan` + requestId). authLimiter/apiLimiter ở `middlewares/rateLimiter.middleware.ts`.

**Xử lý:** Nếu là bot: chặn ở edge (Cloudflare). Nếu là người dùng thật: nới ngưỡng.

### LoginFailureSpike

**Mức:** `warning` · **Nhóm:** `security`  
**Điều kiện:** `sum(rate(jobportal_auth_events_total{event="login_failed"}[5m])) > 1` (for 5m)

**Kiểm tra:** Log đăng nhập thất bại nhóm theo IP/email. So sánh với `HttpRateLimiting`.

**Xử lý:** Siết `authLimiter`, bật captcha/khoá tạm theo IP, thông báo người dùng đổi mật khẩu nếu có dấu hiệu lộ.

### RefreshTokenFailures

**Mức:** `warning` · **Nhóm:** `auth`  
**Điều kiện:** `sum(rate(jobportal_auth_events_total{event="refresh_failed"}[10m])) > 1` (for 10m)

**Kiểm tra:** Redis còn session không (`RedisCommandErrors`)? `JWT_REFRESH_SECRET` có bị đổi ở lần deploy gần nhất? Client có lặp vô hạn?

**Xử lý:** Khôi phục Redis/secret; sửa client nếu lặp vòng.

### DbQueryErrors

**Mức:** `critical` · **Nhóm:** `database`  
**Điều kiện:** `sum(rate(jobportal_db_query_errors_total[5m])) > 0.2` (for 5m)

**Kiểm tra:** Sentry (có mã SQLSTATE) + log. 57014 = statement_timeout, 40P01 = deadlock, kết nối bị ngắt.

**Xử lý:** Sửa query/khoá; kiểm tra Supabase còn sống & chưa hết connection; chạy migration nếu thiếu cột.

### DbQueryLatencyP95High

**Mức:** `warning` · **Nhóm:** `database`  
**Điều kiện:** `job:db_query_seconds:p95_5m > 0.5` (for 10m)

**Kiểm tra:** _Data stores_ → latency theo operation; log WARN 'Slow query' (có SQL parametrize + requestId).

**Xử lý:** EXPLAIN ANALYZE, thêm index, giảm N+1; kiểm tra Supabase CPU/IO.

### DbSlowQueries

**Mức:** `warning` · **Nhóm:** `database`  
**Điều kiện:** `sum(rate(jobportal_db_slow_queries_total[5m])) > 0.1` (for 10m)

**Kiểm tra:** Tìm log `Slow query` — mỗi dòng có SQL + requestId + route.

**Xử lý:** Dùng `scripts/explain-analyze.sql`; tối ưu hoặc thêm index (nhớ viết migration).

### NPlusOneSuspected

**Mức:** `info` · **Nhóm:** `database`  
**Điều kiện:** `sum by (route) (increase(jobportal_n_plus_one_suspects_total[1h])) > 20`

**Kiểm tra:** Log WARN N+1 có route + câu SQL lặp. Biểu đồ 'Số query mỗi request'.

**Xử lý:** Gộp query (IN/JOIN/batch) như đã làm với `findOrCreateTags`.

### PostgresDown

**Mức:** `critical` · **Nhóm:** `database`  
**Điều kiện:** `pg_up == 0` (for 1m)

**Kiểm tra:** Cần postgres-exporter. Kiểm tra DB trực tiếp.

**Xử lý:** Khôi phục DB; kiểm tra thông tin kết nối của exporter.

### PostgresConnectionsNearLimit

**Mức:** `warning` · **Nhóm:** `database`  
**Điều kiện:** `sum(pg_stat_activity_count) / max(pg_settings_max_connections) > 0.8` (for 10m)

**Kiểm tra:** `pg_stat_activity_count` theo state/app. Pool TypeORM quá lớn × số instance?

**Xử lý:** Giảm `max` pool, dùng PgBouncer/pooler của Supabase, tìm connection idle-in-transaction.

### RedisCommandErrors

**Mức:** `critical` · **Nhóm:** `redis`  
**Điều kiện:** `sum(rate(jobportal_redis_command_errors_total[5m])) > 0.1` (for 5m)

**Kiểm tra:** Log `[redis]`; Redis có sống/OOM/hết kết nối? (CloudRedis/Upstash hạn mức).

**Xử lý:** Khôi phục Redis. Trong lúc Redis chết: đăng nhập/refresh/idempotency lỗi — cân nhắc thông báo bảo trì.

### RedisLatencyHigh

**Mức:** `warning` · **Nhóm:** `redis`  
**Điều kiện:** `histogram_quantile(0.95, sum by (le) (rate(jobportal_redis_command_duration_seconds_bucket[5m]))) > 0.1` (for 10m)

**Kiểm tra:** Lệnh nào chậm (panel 'Lệnh Redis p95 theo command')? Key lớn? Mạng tới Redis?

**Xử lý:** Giảm kích thước value, chuyển region gần app.

### UserCacheHitRatioLow

**Mức:** `info` · **Nhóm:** `redis`  
**Điều kiện:** `prefix:redis_cache_hit:ratio_rate15m{prefix="auth:userCache"} < 0.5` (for 30m)

**Kiểm tra:** TTL `auth:userCache` = 5 phút; hit thấp do traffic rải rác hoặc cache bị xoá liên tục.

**Xử lý:** Chỉ là tín hiệu tối ưu (info) — tăng TTL nếu phù hợp.

### RedisDown

**Mức:** `critical` · **Nhóm:** `redis`  
**Điều kiện:** `redis_up == 0` (for 1m)

**Kiểm tra:** redis-exporter không kết nối Redis.

**Xử lý:** Khôi phục Redis / sửa `REDIS_ADDR` của exporter.

### MqDisconnected

**Mức:** `critical` · **Nhóm:** `queue`  
**Điều kiện:** `jobportal_mq_connected == 0` (for 2m)

**Kiểm tra:** Log `[MQ]`; CloudAMQP dashboard (kết nối/hạn mức/ngủ đông). Workflow keep-alive RabbitMQ có chạy?

**Xử lý:** Khôi phục broker. Event nhóm chat vẫn an toàn trong bảng outbox và sẽ được relay lại khi MQ trở lại.

### MqReconnectStorm

**Mức:** `warning` · **Nhóm:** `queue`  
**Điều kiện:** `increase(jobportal_mq_reconnect_attempts_total[10m]) > 5`

**Kiểm tra:** Kết nối chập chờn: mạng/broker restart/credentials.

**Xử lý:** Kiểm tra CloudAMQP; xem lỗi trong log `[MQ] reconnect`.

### MqPublishFailures

**Mức:** `warning` · **Nhóm:** `queue`  
**Điều kiện:** `sum(rate(jobportal_mq_publish_total{result=~"error|not_ready|backpressure"}[5m])) > 0` (for 5m)

**Kiểm tra:** Nhãn `result` của `jobportal_mq_publish_total`: not_ready (chưa kết nối), backpressure (đầy buffer), error.

**Xử lý:** not_ready → xem MqDisconnected; backpressure → giảm tải/tăng prefetch; error → Sentry.

### MqMessageDeadLettered

**Mức:** `critical` · **Nhóm:** `queue`  
**Điều kiện:** `sum by (queue) (increase(jobportal_mq_messages_total{result="dead"}[15m])) > 0`

**Kiểm tra:** Sentry + log `[MQ] ... exceeded 5 attempts`. Xem message trong `dead-letter.queue` (CloudAMQP UI → Get messages).

**Xử lý:** Sửa lỗi consumer, sau đó replay tay (shovel/publish lại). Không replay trước khi sửa — sẽ vào DLQ lại.

### MqRetriesHigh

**Mức:** `warning` · **Nhóm:** `queue`  
**Điều kiện:** `sum by (queue) (rate(jobportal_mq_messages_total{result="retry"}[10m])) > 0.5` (for 10m)

**Kiểm tra:** Consumer lỗi tạm thời: DB/Redis/WS lỗi? Xem lỗi retry trong log.

**Xử lý:** Sửa nguyên nhân gốc trước khi message cạn 5 lượt và vào DLQ.

### RabbitMqDeadLetterQueueNotEmpty

**Mức:** `warning` · **Nhóm:** `queue`  
**Điều kiện:** `rabbitmq_queue_messages_ready{queue="dead-letter.queue"} > 0` (for 5m)

**Kiểm tra:** Cần scrape rabbitmq:15692 (plugin prometheus).

**Xử lý:** Xem `MqMessageDeadLettered`.

### OutboxBacklogHigh

**Mức:** `warning` · **Nhóm:** `outbox`  
**Điều kiện:** `jobportal_outbox_pending > 100` (for 5m)

**Kiểm tra:** `jobportal_outbox_pending` tăng: relay chậm hay MQ chậm? `OUTBOX_POLL_MS`, `OUTBOX_BATCH_SIZE`.

**Xử lý:** Tăng batch/giảm poll interval; kiểm tra MQ.

### OutboxBacklogCritical

**Mức:** `critical` · **Nhóm:** `outbox`  
**Điều kiện:** `jobportal_outbox_pending > 1000` (for 5m)

**Kiểm tra:** Như BacklogHigh nhưng nghiêm trọng — realtime group chat trễ nhiều.

**Xử lý:** Xử lý ngay: kiểm tra relay (log `outbox`) và MQ.

### OutboxStuck

**Mức:** `critical` · **Nhóm:** `outbox`  
**Điều kiện:** `jobportal_outbox_pending > 0 and on() (sum(rate(jobportal_outbox_events_total{result="published"}[10m])) or vector(0)) == 0` (for 10m)

**Kiểm tra:** Relay không publish được gì dù có event. Log `outbox-relay`; `MqDisconnected` có bắn không?

**Xử lý:** Restart process (relay chạy trong cùng API); khôi phục MQ.

### OutboxDeadEvents

**Mức:** `critical` · **Nhóm:** `outbox`  
**Điều kiện:** `jobportal_outbox_dead > 0` (for 1m)

**Kiểm tra:** Query bảng `outbox_events` WHERE status='dead' — xem `last_error`.

**Xử lý:** Sửa nguyên nhân, đặt lại trạng thái/attempts để relay thử lại (thao tác thủ công có kiểm soát).

### ExternalCallFailing

**Mức:** `warning` · **Nhóm:** `external`  
**Điều kiện:** `service:external_call_errors:ratio_rate5m > 0.2 and sum by (service) (rate(jobportal_external_call_duration_seconds_count[5m])) > 0.02` (for 10m)

**Kiểm tra:** Nhãn `service` (Cloudinary upload/SMTP sendMail/…). Kiểm tra status page của nhà cung cấp, key/hạn mức.

**Xử lý:** Đợi/khắc phục nhà cung cấp; kiểm tra timeout `CLOUDINARY_TIMEOUT_MS`/`EMAIL_TIMEOUT_MS`.

### ExternalCallSlow

**Mức:** `warning` · **Nhóm:** `external`  
**Điều kiện:** `service:external_call_seconds:p95_5m > 10` (for 10m)

**Kiểm tra:** Như trên; so với timeout cấu hình.

**Xử lý:** Giảm kích thước upload, tăng/giảm timeout phù hợp, xem region.

### WebSocketConnectionsDropped

**Mức:** `warning` · **Nhóm:** `realtime`  
**Điều kiện:** `jobportal_ws_connections == 0 and max_over_time(jobportal_ws_connections[1h]) > 10` (for 5m)

**Kiểm tra:** Trước đó có >10 kết nối giờ về 0: API restart? CORS/Socket path? Reverse proxy đóng WS?

**Xử lý:** Kiểm tra deploy gần nhất & cấu hình proxy cho WebSocket.

### EventLoopLagHigh

**Mức:** `warning` · **Nhóm:** `runtime`  
**Điều kiện:** `jobportal_nodejs_eventloop_lag_p99_seconds > 0.5` (for 5m)

**Kiểm tra:** Event loop bị chặn: JSON lớn, bcrypt, parse PDF, vòng lặp đồng bộ. Dùng `--cpu-prof` hoặc Sentry profiling.

**Xử lý:** Chuyển tác vụ nặng sang worker/queue; giảm kích thước payload.

### HeapUsageHigh

**Mức:** `warning` · **Nhóm:** `runtime`  
**Điều kiện:** `jobportal_nodejs_heap_size_used_bytes / jobportal_nodejs_heap_size_total_bytes > 0.9` (for 15m)

**Kiểm tra:** Heap tăng đều không xuống sau GC → rò rỉ. So sánh 'Active handles' và heap theo thời gian.

**Xử lý:** Heap snapshot (`node --inspect`), tìm listener/Map không dọn; restart tạm thời.

### MemoryNearLimit

**Mức:** `warning` · **Nhóm:** `runtime`  
**Điều kiện:** `jobportal_process_resident_memory_bytes > 400 * 1024 * 1024` (for 10m)

**Kiểm tra:** RSS gần hạn mức RAM của instance. Ngưỡng 400MB trong rule giả định gói 512MB — chỉnh theo thực tế.

**Xử lý:** Tăng RAM hoặc giảm bộ nhớ (xem HeapUsageHigh).

### CpuSaturated

**Mức:** `warning` · **Nhóm:** `runtime`  
**Điều kiện:** `rate(jobportal_process_cpu_seconds_total[5m]) > 0.8` (for 10m)

**Kiểm tra:** CPU >80% 1 core kéo dài.

**Xử lý:** Tìm route nặng (Tempo), tối ưu hoặc scale ngang.

### FileDescriptorsNearLimit

**Mức:** `warning` · **Nhóm:** `runtime`  
**Điều kiện:** `jobportal_process_open_fds / jobportal_process_max_fds > 0.8` (for 10m)

**Kiểm tra:** Rò rỉ socket/file: `jobportal_nodejs_active_handles_total` tăng đều.

**Xử lý:** Tìm connection không đóng; restart tạm thời.

### MonitoringTargetDown

**Mức:** `warning` · **Nhóm:** `meta`  
**Điều kiện:** `up{job=~"otel-collector|alertmanager|tempo|postgres|redis|rabbitmq"} == 0` (for 5m)

**Kiểm tra:** Nhãn `job` cho biết thành phần nào (collector/alertmanager/tempo/postgres/redis/rabbitmq).

**Xử lý:** Khởi động lại thành phần; kiểm tra mạng compose.

### OtelCollectorDroppingSpans

**Mức:** `warning` · **Nhóm:** `meta`  
**Điều kiện:** `sum(rate(otelcol_exporter_send_failed_spans_total[5m])) > 0` (for 5m)

**Kiểm tra:** Collector không gửi được tới Tempo: Tempo down/đầy đĩa/sai endpoint.

**Xử lý:** Khôi phục Tempo; trace tạm mất nhưng app không bị ảnh hưởng.

### AlertmanagerNotificationsFailing

**Mức:** `warning` · **Nhóm:** `meta`  
**Điều kiện:** `sum by (integration) (rate(alertmanager_notifications_failed_total[10m])) > 0` (for 10m)

**Kiểm tra:** `integration` = telegram → sai token/chat_id, bot bị chặn, mạng.

**Xử lý:** Sửa `alertmanager/secrets/telegram_bot_token` và `chat_id`; gửi thử bằng `amtool alert add`.

### PrometheusRuleEvaluationFailing

**Mức:** `warning` · **Nhóm:** `meta`  
**Điều kiện:** `increase(prometheus_rule_evaluation_failures_total[10m]) > 0`

**Kiểm tra:** `promtool check rules`; xem log Prometheus.

**Xử lý:** Sửa rule lỗi cú pháp/nhãn.
