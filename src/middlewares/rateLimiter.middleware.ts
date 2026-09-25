import rateLimit from "express-rate-limit";
import { HTTP_STATUS, HTTP_MESSAGE } from "../constants/httpStatus";
import { decodeToken } from "../utils/token.utils";
import { Request } from "express";

// Helper get IP: Ipv4 and Ipv6, support behind proxy
const getClientIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" ? forwarded.split(",")[0] : null) ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown";

  return ip.replace(/^::ffff:/, "");
};

// Các route polling nhẹ (bell/badge/session-check) được gọi lặp lại theo
// interval hoặc mỗi lần socket reconnect — không phải hành vi bất thường,
// nên loại khỏi apiLimiter global và để tự chịu tải riêng (hoặc limiter
// riêng nhẹ hơn nếu cần sau này). req.path ở đây đã tương đối so với
// API_PREFIX (vd "/auth/me", "/notifications/unread-count").
const LIGHT_POLLING_PATHS = [
  "/auth/me",
  "/notifications/unread-count",
  "/chat/unread-count",
];

const isLightPollingRoute = (req: Request): boolean =>
  LIGHT_POLLING_PATHS.some((p) => req.path === p);

// General API rate limiter
//
// FIX: trước đây key theo IP (default) với max=100/15 phút — quá thấp so với
// pattern thực tế của app (socket reconnect + polling định kỳ có thể bắn
// 8-10 request/phút CHO MỖI user). Nhiều user sau NAT/proxy dùng chung IP
// càng dễ cộng dồn chạm ngưỡng. Đổi sang:
//  - keyGenerator theo user id (decode JWT, không cần verify — chỉ dùng để
//    phân nhóm rate-limit, không phải quyết định auth) khi đã đăng nhập,
//    fallback về IP cho request chưa auth.
//  - Nới max lên mức đủ chịu được polling/reconnect bình thường của 1 user,
//    vẫn đủ chặn abuse thật sự.
//  - Bỏ qua các route polling nhẹ đã liệt kê ở trên.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600, // ~40 req/phút/user trung bình trong cửa sổ 15 phút
  keyGenerator: (req: Request): string => {
    try {
      const header = req.headers.authorization;
      if (header?.startsWith("Bearer ")) {
        const token = header.split(" ")[1];
        const decoded = decodeToken(token);
        if (decoded?.id) return `api:userId:${decoded.id}`;
      }
    } catch {}
    return `api:ip:${getClientIp(req)}`;
  },
  skip: isLightPollingRoute,
  message: { success: false, message: HTTP_MESSAGE.TOO_MANY_REQUESTS },
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

// Auth endpoints rate limiter - login, register, forgot password
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 10000 : 5,
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later",
  },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

// Refresh token limiter
export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req: Request): string => {
    try {
      const token = req.cookies?.refreshToken;
      if (token) {
        const decoded = decodeToken(token);
        if (decoded?.id) return `refresh:userId:${decoded.id}`;
      }
    } catch {}
    return `refresh:ip:${getClientIp(req)}`;
  },
  message: {
    success: false,
    message: "Too many token refresh attempts, please try again later",
  },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

// Public upload limiter
export const publicUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req: Request): string => {
    return `public-upload:ip:${getClientIp(req)}`;
  },
  message: {
    success: false,
    message: "Too many file uploads, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

// File upload rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req: Request): string => {
    if (req.user?.id) return `upload:userId:${req.user.id}`;
    return `upload:ip:${getClientIp(req)}`;
  },
  message: {
    success: false,
    message: "Too many file uploads, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

// Job creation rate limiter
export const jobCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req: Request): string => {
    if (req.user?.id) return `job:userId:${req.user.id}`;
    return `job:ip:${getClientIp(req)}`;
  },
  message: {
    success: false,
    message: "Too many job posts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});
