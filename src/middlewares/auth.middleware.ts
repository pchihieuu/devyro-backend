import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config/database.config";
import { User } from "../entities/User.entity";
import { verifyAccessToken } from "../utils/token.utils";

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = req.headers.authorization;

    if (!token || !token.startsWith("Bearer")) {
      res.status(401).json({
        success: false,
        message: "Not authorized, no token provided",
      });
      return;
    }

    token = token.split(" ")[1];

    // Verify access token
    const decoded = verifyAccessToken(token);

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
      res.status(401).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    // Check if token is expired
    if (error instanceof Error && error.message === "TOKEN_EXPIRED") {
      res.status(401).json({
        success: false,
        message: "Access token expired",
        code: "TOKEN_EXPIRED",
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: "Invalid access token",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};


export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.headers.authorization;

  // Không có token / sai format -> coi như khách vãng lai, cho qua luôn
  if (!token || !token.startsWith("Bearer")) {
    return next();
  }

  try {
    const accessToken = token.split(" ")[1];
    const decoded = verifyAccessToken(accessToken);

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

    if (user) {
      req.user = user;
    }
  } catch {
    // Token hết hạn / sai / bị chỉnh sửa -> im lặng bỏ qua, không throw 401
    // Khác với `protect`: lỗi token ở đây không được phép chặn user xem trang public
  }

  next();
};
