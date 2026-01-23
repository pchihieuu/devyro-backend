import jwt from "jsonwebtoken";
import { JwtPayload } from "../types/express";
import { config } from "../config/env.config";

export const generateToken = (id: string): string => {
  const payload = { id };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
};
