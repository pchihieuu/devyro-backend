import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import {
  ExpressInstrumentation,
  ExpressLayerType,
} from "@opentelemetry/instrumentation-express";
import { AmqplibInstrumentation } from "@opentelemetry/instrumentation-amqplib";
import { SocketIoInstrumentation } from "@opentelemetry/instrumentation-socket.io";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";
import { trace } from "@opentelemetry/api";

/**
 * Distributed tracing (OpenTelemetry) — TUỲ CHỌN, bật khi đặt
 * OTEL_EXPORTER_OTLP_ENDPOINT (vd http://otel-collector:4318). Không đặt =
 * không load gì thêm, không tốn hiệu năng.
 *
 * Span tự động cho: HTTP in/out, Express route, mỗi câu SQL (pg), lệnh Redis,
 * RabbitMQ (publish/consume — trace đi xuyên qua queue từ API sang worker) và
 * Socket.IO. Cloudinary/Gemini là HTTP outbound nên đã có span http.
 *
 * Mặc định lấy mẫu: production 10% (parentbased_traceidratio), dev 100%.
 * Ghi đè bằng OTEL_TRACES_SAMPLER / OTEL_TRACES_SAMPLER_ARG.
 *
 * PHẢI import TRƯỚC express/pg/ioredis (xem đầu server.ts) để instrumentation
 * kịp patch module.
 *
 * Cấu hình qua biến chuẩn OTel: OTEL_EXPORTER_OTLP_ENDPOINT,
 * OTEL_EXPORTER_OTLP_HEADERS, OTEL_TRACES_SAMPLER(_ARG), OTEL_SERVICE_NAME.
 */
export const otelEnabled = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);

if (otelEnabled) {
  // NodeSDK đọc 2 biến chuẩn này; đặt mặc định hợp lý nếu chưa cấu hình.
  process.env.OTEL_TRACES_SAMPLER ??= "parentbased_traceidratio";
  process.env.OTEL_TRACES_SAMPLER_ARG ??=
    process.env.NODE_ENV === "production" ? "0.1" : "1";
}

const IGNORED_PATHS = /^\/(metrics|health|docs)(\/|\?|$)/;

let sdk: NodeSDK | undefined;

if (otelEnabled) {
  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "job-portal-backend",
      "service.version":
        process.env.SENTRY_RELEASE || process.env.npm_package_version || "unknown",
      "deployment.environment.name": process.env.NODE_ENV || "development",
    }),
    traceExporter: new OTLPTraceExporter(), // đọc endpoint/headers từ env chuẩn
    instrumentations: [
      new HttpInstrumentation({
        // Không tạo trace cho scrape/health — nhiễu và tốn chỗ.
        ignoreIncomingRequestHook: (req) => IGNORED_PATHS.test(req.url ?? ""),
      }),
      // Bỏ span cho từng middleware (query, expressInit, helmet, cors...) — nhiễu,
      // chỉ giữ span router + request handler để thấy đúng route.
      new ExpressInstrumentation({
        ignoreLayersType: [ExpressLayerType.MIDDLEWARE],
      }),
      new AmqplibInstrumentation(),
      new SocketIoInstrumentation(),
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
