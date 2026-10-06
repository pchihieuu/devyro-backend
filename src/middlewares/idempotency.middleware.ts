import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { redisClient } from "../config/redis.config";
import { HTTP_STATUS } from "../constants/httpStatus";
import { BadRequestError, ConflictError, AppError } from "../utils/errors";
import { logger } from "../utils/logger";

/**
 * Idempotency-Key cho các POST tạo tài nguyên (double-submit khi mạng chậm →
 * user bấm 2 lần = 2 record).
 *
 * OPT-IN theo client: request KHÔNG gửi header `Idempotency-Key` thì middleware
 * bỏ qua hoàn toàn → không đổi hành vi FE hiện tại; FE thêm header (vd
 * crypto.randomUUID() sinh 1 lần cho mỗi lần submit form) là được bảo vệ.
 *
 * Hành vi:
 *  - Lần đầu: giữ khoá "processing" (NX), chạy handler, lưu response 2xx.
 *  - Gửi lại cùng key + cùng payload: trả lại đúng response đã lưu, kèm header
 *    `Idempotency-Replayed: true`, KHÔNG chạy lại handler.
 *  - Gửi lại khi request đầu còn đang chạy: 409.
 *  - Cùng key nhưng payload khác: 422 (client dùng lại key sai cách).
 *  - Response không phải 2xx: giải phóng khoá để client retry được.
 *  - Redis lỗi: fail-open (cho request đi tiếp) — idempotency là lớp bảo vệ
 *    phụ, không được làm sập endpoint.
 *
 * PHẢI đặt SAU `protect` để khoá theo user id (fallback IP).
 */

const HEADER = "idempotency-key";
const KEY_PATTERN = /^[A-Za-z0-9_\-:.]{8,128}$/;
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const PROCESSING_TTL_SECONDS = 120;
const MAX_CACHED_BODY_BYTES = 256 * 1024;

interface StoredEntry {
  state: "processing" | "done";
  fingerprint: string;
  status?: number;
  body?: unknown;
}

class IdempotencyKeyMismatchError extends AppError {
  constructor() {
    super(
      "Idempotency-Key was already used with a different request payload",
      HTTP_STATUS.UNPROCESSABLE_ENTITY
    );
  }
}

const sha256 = (input: string): string =>
  crypto.createHash("sha256").update(input).digest("hex");

const parseEntry = (raw: string | null): StoredEntry | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredEntry;
  } catch {
    return null;
  }
};

export const idempotency =
  (options: { ttlSeconds?: number } = {}) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rawKey = req.header(HEADER);
    if (!rawKey) return next();

    if (!KEY_PATTERN.test(rawKey)) {
      return next(
        new BadRequestError(
          "Invalid Idempotency-Key (8-128 chars: letters, digits, _ - : .)"
        )
      );
    }

    const ttl = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    const scope = req.user?.id ?? `ip:${req.ip}`;
    const path = req.originalUrl.split("?")[0];
    const redisKey = `idem:${sha256(`${scope}|${req.method}|${path}|${rawKey}`)}`;
    const fingerprint = sha256(JSON.stringify(req.body ?? {}));

    try {
      const acquired = await redisClient.set(
        redisKey,
        JSON.stringify({ state: "processing", fingerprint } satisfies StoredEntry),
        "EX",
        PROCESSING_TTL_SECONDS,
        "NX"
      );

      if (acquired !== "OK") {
        const existing = parseEntry(await redisClient.get(redisKey));

        if (!existing) {
          // Khoá vừa hết hạn/bị xoá giữa 2 lệnh — coi như đang xử lý, để client thử lại.
          return next(new ConflictError("Request is being processed, retry shortly"));
        }
        if (existing.fingerprint !== fingerprint) {
          return next(new IdempotencyKeyMismatchError());
        }
        if (existing.state === "processing") {
          res.setHeader("Retry-After", "1");
          return next(
            new ConflictError("A request with this Idempotency-Key is still being processed")
          );
        }

        res.setHeader("Idempotency-Replayed", "true");
        res.status(existing.status ?? HTTP_STATUS.OK).json(existing.body);
        return;
      }
    } catch (error) {
      logger.warn("Idempotency check skipped (Redis error)", {
        requestId: req.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return next();
    }

    // Chặn mọi res.json để lưu (2xx) hoặc nhả khoá (lỗi).
    const originalJson = res.json.bind(res);
    res.json = (body?: unknown): Response => {
      const status = res.statusCode;
      const size = Buffer.byteLength(JSON.stringify(body ?? null));

      const persist =
        status >= 200 && status < 300 && size <= MAX_CACHED_BODY_BYTES
          ? redisClient.set(
              redisKey,
              JSON.stringify({ state: "done", fingerprint, status, body } satisfies StoredEntry),
              "EX",
              ttl
            )
          : redisClient.del(redisKey);

      persist.catch((error: unknown) =>
        logger.warn("Idempotency store failed", {
          requestId: req.id,
          error: error instanceof Error ? error.message : String(error),
        })
      );

      return originalJson(body);
    };

    next();
  };
