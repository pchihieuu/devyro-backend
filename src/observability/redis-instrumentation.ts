import type { Command, Redis } from "ioredis";
import {
  redisCacheOps,
  redisCommandDuration,
  redisCommandErrors,
} from "./metrics";

/**
 * Đo mọi lệnh Redis bằng cách bọc `sendCommand` (ioredis đẩy cả lệnh lẻ lẫn
 * pipeline/multi qua đây). Không sửa `session.repository.ts` — mọi nơi dùng
 * `redisClient` tự được đo.
 *
 * Hit/miss chỉ tính cho lệnh có ngữ nghĩa "tra cứu": GET (null = miss) và
 * EXISTS (0 = miss), nhóm theo prefix 2 segment đầu của key. Lưu ý với prefix
 * kiểu blacklist (`auth:blacklist`) "miss" là kết quả BÌNH THƯỜNG (token chưa
 * bị thu hồi) — hãy đọc hit-ratio theo từng prefix, chủ yếu ý nghĩa với
 * `auth:userCache`.
 */
const prefixOf = (key: unknown): string => {
  const text = Buffer.isBuffer(key) ? key.toString() : String(key ?? "");
  return text.split(":").slice(0, 2).join(":") || "unknown";
};

let installed = false;

export const instrumentRedis = (client: Redis): void => {
  if (installed) return;
  installed = true;

  const original = client.sendCommand.bind(client) as (
    command: Command,
    stream?: unknown
  ) => unknown;

  (client as unknown as { sendCommand: typeof original }).sendCommand = (
    command,
    stream
  ) => {
    const name = command.name.toLowerCase();
    const start = process.hrtime.bigint();
    const observe = () =>
      redisCommandDuration.observe(
        { command: name },
        Number(process.hrtime.bigint() - start) / 1e9
      );

    const result = original(command, stream);

    command.promise.then(
      (reply: unknown) => {
        observe();
        if (name === "get" || name === "exists") {
          const miss = name === "get" ? reply === null : reply === 0;
          redisCacheOps.inc({
            prefix: prefixOf(command.args[0]),
            result: miss ? "miss" : "hit",
          });
        }
      },
      () => {
        observe();
        redisCommandErrors.inc({ command: name });
      }
    );

    return result;
  };
};
