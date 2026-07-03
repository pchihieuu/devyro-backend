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

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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
