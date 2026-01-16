import rateLimit from "express-rate-limit";
import { HTTP_STATUS, HTTP_MESSAGE } from "../constants/httpStatus";

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: HTTP_MESSAGE.TOO_MANY_REQUESTS,
  },
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

// Auth endpoints rate limiter (stricter)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later",
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

// File upload rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 uploads per hour
  message: {
    success: false,
    message: "Too many file uploads, please try again later",
  },
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

// Job creation rate limiter (for employers)
export const jobCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit to 20 job posts per hour
  message: {
    success: false,
    message: "Too many job posts, please try again later",
  },
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});