import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config/database.config";
import { User } from "../entities/User.entity";
import { verifyToken } from "../utils/token.utils";

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = req.headers.authorization;

    if (!token || !token.startsWith("Bearer")) {
      res.status(401).json({ message: "Not authorized, no token" });
      return;
    }

    token = token.split(" ")[1];
    const decoded = verifyToken(token);

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: decoded.id },
      select: [
        "id",
        "name",
        "email",
        "role",
        "avatar",
        "resume",
        "createdAt",
        "updatedAt",
      ],
    });

    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      message: "Token failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
