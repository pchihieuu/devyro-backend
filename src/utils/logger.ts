import winston from "winston";
import path from "path";
import { trace } from "@opentelemetry/api";
import { requestStore } from "../observability/als";

/**
 * Gắn requestId + traceId/spanId vào MỌI dòng log (kể cả log từ service/
 * repository không có `req`). Từ 1 dòng log copy traceId sang Grafana Tempo
 * (hoặc requestId sang Sentry tag) để xem toàn bộ request.
 */
const correlation = winston.format((info) => {
  const store = requestStore.getStore();
  const span = trace.getActiveSpan()?.spanContext();
  if (store?.requestId && info.requestId === undefined) info.requestId = store.requestId;
  if (span && info.traceId === undefined) {
    info.traceId = span.traceId;
    info.spanId = span.spanId;
  }
  return info;
});

const logFormat = winston.format.combine(
  correlation(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  correlation(),
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = "";
    if (Object.keys(meta).length) {
      metaStr = JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

// Add file transports in production
if (process.env.NODE_ENV === "production") {
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/error.log"),
      level: "error",
      format: logFormat,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/combined.log"),
      format: logFormat,
    })
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  transports,
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/exceptions.log"),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/rejections.log"),
    }),
  ],
});

export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
