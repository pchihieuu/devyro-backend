import Redis from "ioredis";
import { config } from "./env.config";
import { instrumentRedis } from "../observability/redis-instrumentation";

class RedisConnection {
  private static instance: Redis;

  static getInstance(): Redis {
    if (!this.instance) {
      this.instance = new Redis(config.redis.url, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 200, 2000),
        ...(config.redis.url.startsWith("rediss://") ? { tls: { rejectUnauthorized: false } } : {}),
      });

      this.instance.on("connect", () => console.log("[redis] connected"));
      this.instance.on("error", (err) =>
        console.error("[redis] client error:", err.message)
      );
    }
    return this.instance;
  }
}

export const redisClient = RedisConnection.getInstance();
instrumentRedis(redisClient);
