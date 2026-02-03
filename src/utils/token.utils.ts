import jwt, { SignOptions } from "jsonwebtoken";
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
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiresIn || "15m",
  } as SignOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshTokenExpiresIn || "7d",
  } as SignOptions);
};

export const generateTokens = (payload: TokenPayload): AuthTokens => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch (error) {
    throw new Error("Invalid or expired access token");
  }
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
  } catch (error) {
    throw new Error("Invalid or expired refresh token");
  }
};

export const decodeToken = (token: string): any => {
  return jwt.decode(token);
};

// Backward compatibility
export const generateToken = (id: string): string => {
  return generateAccessToken({ id, email: "", role: "" });
};

export const verifyToken = verifyAccessToken;
