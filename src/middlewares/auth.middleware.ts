import { Request, Response, NextFunction } from "express";
import {
  AuthRejection,
  authenticateAccessToken,
} from "../services/access-token-auth.service";
import { ApiResponse } from "../utils/api-response";
import { HTTP_STATUS } from "../constants/httpStatus";

const hasBearer = (header: string | undefined): header is string =>
  !!header && header.startsWith("Bearer");

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const header = req.headers.authorization;
  if (!hasBearer(header)) {
    ApiResponse.error(
      res,
      HTTP_STATUS.UNAUTHORIZED,
      "Not authorized, no token provided",
      { requestId: req.id }
    );
    return;
  }

  try {
    const { user, payload } = await authenticateAccessToken(header.split(" ")[1]);
    req.tokenPayload = payload; // để logout controller tái dùng
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AuthRejection) {
      ApiResponse.error(res, HTTP_STATUS.UNAUTHORIZED, error.message, {
        code: error.code,
        requestId: req.id,
      });
      return;
    }

    if (error instanceof Error && error.message === "TOKEN_EXPIRED") {
      ApiResponse.error(res, HTTP_STATUS.UNAUTHORIZED, "Access token expired", {
        code: "TOKEN_EXPIRED",
        requestId: req.id,
      });
      return;
    }

    // Lỗi hạ tầng (Redis/DB sập) KHÔNG được báo thành "token sai" — đẩy sang
    // error middleware để trả 5xx, log và báo lên Sentry. Bản cũ nuốt mọi lỗi
    // thành 401 kèm `error.message` (lộ chi tiết nội bộ, làm client logout oan).
    if (error instanceof Error && error.message === "TOKEN_INVALID") {
      ApiResponse.error(res, HTTP_STATUS.UNAUTHORIZED, "Invalid access token", {
        requestId: req.id,
      });
      return;
    }
    next(error);
  }
};

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const header = req.headers.authorization;

  // Không có token / sai format -> coi như khách vãng lai, cho qua luôn
  if (!hasBearer(header)) return next();

  try {
    const { user, payload } = await authenticateAccessToken(header.split(" ")[1]);
    req.tokenPayload = payload;
    req.user = user;
  } catch {
    // Token hết hạn / sai / bị thu hồi -> im lặng coi như khách vãng lai,
    // không throw 401: lỗi token ở đây không được chặn user xem trang public.
  }

  next();
};
