import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { JwtPayload } from "../types/express";
import { config } from "../config/env.config";

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshJti: string;
  refreshExpiresInSeconds: number;
}

export const parseExpiryToSeconds = (expiry: string): number => {
  const match = /^(\d+)(s|m|h|d)$/.exec(expiry.trim());
  if (!match) {
    throw new Error(`Invalid expiry format: ${expiry}`);
  }
  const value = parseInt(match[1], 10);
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  return value * multipliers[match[2]];
};

export const generateAccessToken = (payload: TokenPayload): string => {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti }, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiresIn || "15m",
  } as SignOptions);
};

/**
 * jti gắn trong payload refresh token dùng làm khóa session trong Redis
 * (session.repository.ts) — KHÔNG lưu chuỗi token vào Redis, chỉ lưu jti.
 */
export const generateRefreshToken = (
  payload: TokenPayload
): { token: string; jti: string; expiresInSeconds: number } => {
  const jti = crypto.randomUUID();
  const expiresIn = config.jwt.refreshTokenExpiresIn || "7d";

  const token = jwt.sign({ ...payload, jti }, config.jwt.refreshSecret, {
    expiresIn,
  } as SignOptions);

  return { token, jti, expiresInSeconds: parseExpiryToSeconds(expiresIn) };
};

export const generateTokens = (payload: TokenPayload): AuthTokens => {
  const accessToken = generateAccessToken(payload);
  const refresh = generateRefreshToken(payload);
  return {
    accessToken,
    refreshToken: refresh.token,
    refreshJti: refresh.jti,
    refreshExpiresInSeconds: refresh.expiresInSeconds,
  };
};

export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("TOKEN_EXPIRED");
    }
    throw new Error("TOKEN_INVALID");
  }
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError)
      throw new Error("REFRESH_TOKEN_EXPIRED");
    throw new Error("REFRESH_TOKEN_INVALID");
  }
};

export const decodeToken = (token: string): any => jwt.decode(token);

export const generateToken = (id: string): string =>
  generateAccessToken({ id, email: "", role: "" });

export const verifyToken = verifyAccessToken;
