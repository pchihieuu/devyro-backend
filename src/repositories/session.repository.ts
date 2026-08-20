import { redisClient } from "../config/redis.config";

const BLACKLIST_PREFIX = "auth:blacklist:"; // logout single device
const VALID_AFTER_PREFIX = "auth:validAfter:"; // logout-all / reset password
const USER_CACHE_PREFIX = "auth:userCache:"; // cache cho protect middleware
const REFRESH_SESSION_PREFIX = "auth:refresh:"; // auth:refresh:<userId>:<jti> -> metadata JSON
const REFRESH_INDEX_PREFIX = "auth:refreshIndex:"; // auth:refreshIndex:<userId> -> Set<jti>

const USER_CACHE_TTL_SECONDS = 5 * 60;
const VALID_AFTER_TTL_SECONDS = 7 * 24 * 60 * 60; // trùng thời hạn refresh token dài nhất

export interface RefreshSessionMetadata {
  deviceInfo?: string;
  ipAddress?: string;
  createdAt: string;
}
export interface ActiveSession {
  id: string; // = jti
  deviceInfo?: string;
  ipAddress?: string;
  createdAt: string;
  expiresAt: Date;
}

export class SessionRepository {
  /** Blacklist đúng 1 access token (logout 1 thiết bị). TTL = thời gian còn lại của token để tự dọn. */
  async blacklistAccessToken(jti: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    await redisClient.set(`${BLACKLIST_PREFIX}${jti}`, "1", "EX", ttlSeconds);
  }

  async isAccessTokenBlacklisted(jti: string): Promise<boolean> {
    return (await redisClient.exists(`${BLACKLIST_PREFIX}${jti}`)) === 1;
  }

  async invalidateAllSessionsBefore(userId: string): Promise<void> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    await redisClient.set(
      `${VALID_AFTER_PREFIX}${userId}`,
      nowSeconds.toString(),
      "EX",
      VALID_AFTER_TTL_SECONDS
    );
    await this.clearUserSessionCache(userId);
  }

  async isTokenIssuedBeforeInvalidation(
    userId: string,
    tokenIat: number
  ): Promise<boolean> {
    const validAfter = await redisClient.get(`${VALID_AFTER_PREFIX}${userId}`);
    return validAfter ? tokenIat < parseInt(validAfter, 10) : false;
  }

  async cacheUserSession(userId: string, userData: unknown): Promise<void> {
    await redisClient.set(
      `${USER_CACHE_PREFIX}${userId}`,
      JSON.stringify(userData),
      "EX",
      USER_CACHE_TTL_SECONDS
    );
  }

  async getCachedUserSession<T>(userId: string): Promise<T | null> {
    const cached = await redisClient.get(`${USER_CACHE_PREFIX}${userId}`);
    return cached ? (JSON.parse(cached) as T) : null;
  }

  async clearUserSessionCache(userId: string): Promise<void> {
    await redisClient.del(`${USER_CACHE_PREFIX}${userId}`);
  }
  // ==================== Refresh token sessions ====================
  private refreshKey(userId: string, jti: string): string {
    return `${REFRESH_SESSION_PREFIX}${userId}:${jti}`;
  }
  
  private refreshIndexKey(userId: string): string {
    return `${REFRESH_INDEX_PREFIX}${userId}`;
  }

  /**
   * Lưu session refresh token mới. TTL = đúng hạn JWT (truyền từ token.utils).
   * Set index dùng để list/revoke-all mà không cần KEYS/SCAN toàn Redis.
   */
  async storeRefreshSession(
    userId: string,
    jti: string,
    ttlSeconds: number,
    metadata: Omit<RefreshSessionMetadata, "createdAt">
  ): Promise<void> {
    const payload: RefreshSessionMetadata = {
      ...metadata,
      createdAt: new Date().toISOString(),
    };

    await redisClient
      .multi()
      .set(
        this.refreshKey(userId, jti),
        JSON.stringify(payload),
        "EX",
        ttlSeconds
      )
      .sadd(this.refreshIndexKey(userId), jti)
      .exec();
  }

  async isRefreshSessionValid(userId: string, jti: string): Promise<boolean> {
    return (await redisClient.exists(this.refreshKey(userId, jti))) === 1;
  }

  /** Dùng khi logout 1 thiết bị hoặc rotation (xóa jti cũ sau khi cấp jti mới) */
  async revokeRefreshSession(userId: string, jti: string): Promise<void> {
    await redisClient
      .multi()
      .del(this.refreshKey(userId, jti))
      .srem(this.refreshIndexKey(userId), jti)
      .exec();
  }

  /** Logout tất cả thiết bị: xóa toàn bộ session refresh token của user */
  async revokeAllRefreshSessions(userId: string): Promise<void> {
    const jtis = await redisClient.smembers(this.refreshIndexKey(userId));
    const multi = redisClient.multi();
    jtis.forEach((jti) => multi.del(this.refreshKey(userId, jti)));
    multi.del(this.refreshIndexKey(userId));
    await multi.exec();
  }

  /**
   * Danh sách session đang hoạt động (cho getActiveSessions).
   * Set index có thể chứa jti đã tự hết hạn theo TTL (Redis không tự SREM
   * khi key con hết hạn) -> lazy cleanup: key nào GET null thì SREM luôn.
   */
  async listActiveRefreshSessions(userId: string): Promise<ActiveSession[]> {
    const jtis = await redisClient.smembers(this.refreshIndexKey(userId));
    if (jtis.length === 0) return [];

    const sessions: ActiveSession[] = [];
    const staleJtis: string[] = [];

    for (const jti of jtis) {
      const key = this.refreshKey(userId, jti);
      const [raw, ttl] = await Promise.all([
        redisClient.get(key),
        redisClient.ttl(key),
      ]);

      if (!raw || ttl <= 0) {
        staleJtis.push(jti);
        continue;
      }

      const metadata = JSON.parse(raw) as RefreshSessionMetadata;
      sessions.push({
        id: jti,
        deviceInfo: metadata.deviceInfo,
        ipAddress: metadata.ipAddress,
        createdAt: metadata.createdAt,
        expiresAt: new Date(Date.now() + ttl * 1000),
      });
    }

    if (staleJtis.length > 0) {
      await redisClient.srem(this.refreshIndexKey(userId), ...staleJtis);
    }

    return sessions.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
}
export const sessionRepository = new SessionRepository();
