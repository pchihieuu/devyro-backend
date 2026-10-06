import { User } from "../entities/User.entity";
import { JwtPayload } from "../types/express";
import { verifyAccessToken } from "../utils/token.utils";
import { sessionRepository } from "../repositories/session.repository";
import { userRepository } from "../repositories/user.repository";

/** Lý do từ chối — middleware/socket map sang 401 / lỗi handshake. */
export class AuthRejection extends Error {
  constructor(
    message: string,
    readonly code?: string
  ) {
    super(message);
  }
}

/** Field user nạp vào `req.user` — không kéo password hash. */
const AUTH_USER_SELECT: (keyof User)[] = [
  "id",
  "name",
  "email",
  "role",
  "avatar",
  "resume",
  "createdAt",
  "updatedAt",
];

/**
 * Nguồn sự thật DUY NHẤT cho "access token này có hợp lệ không, và của ai":
 * chữ ký + hạn → blacklist (logout 1 thiết bị) → validAfter (logout-all/đổi mật
 * khẩu) → user tồn tại (qua cache Redis). Dùng chung cho HTTP middleware
 * (`protect`/`optionalAuth`) và WebSocket handshake để 2 cổng vào không lệch
 * nhau — trước đây socket tự `jwt.verify` với secret fallback cứng và bỏ qua
 * toàn bộ bước blacklist/validAfter.
 *
 * Ném `Error("TOKEN_EXPIRED" | "TOKEN_INVALID")` (từ verifyAccessToken) hoặc
 * `AuthRejection`; lỗi hạ tầng (Redis/DB) được để nổi lên nguyên vẹn.
 */
export const authenticateAccessToken = async (
  token: string
): Promise<{ user: User; payload: JwtPayload }> => {
  const payload = verifyAccessToken(token);

  if (
    payload.jti &&
    (await sessionRepository.isAccessTokenBlacklisted(payload.jti))
  ) {
    throw new AuthRejection("Access token đã bị thu hồi", "TOKEN_REVOKED");
  }

  if (
    payload.iat &&
    (await sessionRepository.isTokenIssuedBeforeInvalidation(
      payload.id,
      payload.iat
    ))
  ) {
    throw new AuthRejection(
      "Phiên đăng nhập đã hết hiệu lực",
      "SESSION_INVALIDATED"
    );
  }

  let user = await sessionRepository.getCachedUserSession<User>(payload.id);
  if (!user) {
    user = await userRepository.findByIdSelect(payload.id, AUTH_USER_SELECT);
    if (!user) throw new AuthRejection("User not found");
    await sessionRepository.cacheUserSession(payload.id, user);
  }

  return { user, payload };
};
