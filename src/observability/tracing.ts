import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";
import { trace } from "@opentelemetry/api";

/**
 * Distributed tracing (OpenTelemetry) — TUỲ CHỌN, bật khi đặt
 * OTEL_EXPORTER_OTLP_ENDPOINT (vd http://otel-collector:4318). Không đặt =
 * không load gì thêm, không tốn hiệu năng.
 *
 * Span tự động cho: HTTP in/out, Express route, mỗi câu SQL (pg) và lệnh Redis
 * → có latency breakdown theo dependency. RabbitMQ/Cloudinary/Gemini không có
 * instrumentation chính thức nhẹ ở đây: phần HTTP outbound (Cloudinary, Gemini
 * REST) đã được span http bao phủ; AMQP có thể thêm sau nếu cần.
 *
 * PHẢI import TRƯỚC express/pg/ioredis (xem đầu server.ts) để instrumentation
 * kịp patch module.
 *
 * Cấu hình qua biến chuẩn OTel: OTEL_EXPORTER_OTLP_ENDPOINT,
 * OTEL_EXPORTER_OTLP_HEADERS, OTEL_TRACES_SAMPLER(_ARG), OTEL_SERVICE_NAME.
 */
export const otelEnabled = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);

let sdk: NodeSDK | undefined;

if (otelEnabled) {
  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "job-portal-backend",
    }),
    traceExporter: new OTLPTraceExporter(), // đọc endpoint/headers từ env chuẩn
    instrumentations: [
      new HttpInstrumentation({
        // Không tạo trace cho scrape/health — nhiễu và tốn chỗ.
        ignoreIncomingRequestHook: (req) =>
          req.url === "/metrics" || req.url === "/health",
      }),
      new ExpressInstrumentation(),
      new PgInstrumentation({ enhancedDatabaseReporting: false }), // KHÔNG đính kèm giá trị tham số
      new IORedisInstrumentation({ requireParentSpan: true }),
    ],
  });
  sdk.start();
}

/** traceId của span đang active — gắn vào log để nhảy từ log sang trace. */
export const currentTraceId = (): string | undefined =>
  trace.getActiveSpan()?.spanContext().traceId;

export const shutdownTracing = async (): Promise<void> => {
  if (sdk) await sdk.shutdown();
};
