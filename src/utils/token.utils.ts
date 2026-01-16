import jwt from "jsonwebtoken";
import { JwtPayload } from "../types/express";

export const generateToken = (id: string): string => {
  const payload = { id };
  const secret = process.env.JWT_SECRET as string;

  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

export const verifyToken = (token: string): JwtPayload => {
  const secret = process.env.JWT_SECRET as string;
  return jwt.verify(token, secret) as JwtPayload;
};
