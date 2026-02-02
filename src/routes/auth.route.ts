import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  authLimiter,
  uploadLimiter,
} from "../middlewares/rateLimiter.middleware";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyResetTokenSchema,
} from "../validators/auth.validator";
import {
  register,
  login,
  getMe,
  uploadImage,
  uploadResume,
  logout,
  logoutAll,
  getActiveSessions,
  revokeSession,
  refreshToken,
  uploadImagePublic,
  forgotPassword,
  resetPassword,
  verifyResetToken,
} from "../controllers/auth.controller";
import upload from "../middlewares/upload.middleware";
import { ROUTES } from "../constants/routes";

const router = Router();

router.post(
  ROUTES.AUTH.REGISTER,
  authLimiter,
  validate(registerSchema),
  register
);

router.post(ROUTES.AUTH.LOGIN, authLimiter, validate(loginSchema), login);

router.post(
  ROUTES.AUTH.REFRESH_TOKEN,
  authLimiter,
  validate(refreshTokenSchema),
  refreshToken
);

router.post(
  ROUTES.AUTH.UPLOAD_IMAGE_PUBLIC,
  uploadLimiter,
  upload.single("image"),
  uploadImagePublic
);

router.post(
  ROUTES.AUTH.FORGOT_PASSWORD,
  authLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
);

router.post(
  ROUTES.AUTH.RESET_PASSWORD,
  authLimiter,
  validate(resetPasswordSchema),
  resetPassword
);

router.get(
  ROUTES.AUTH.VERIFY_RESET_TOKEN,
  validate(verifyResetTokenSchema),
  verifyResetToken
);

router.get(ROUTES.AUTH.ME, protect, getMe);
router.post(ROUTES.AUTH.LOGOUT, protect, logout);

router.post(ROUTES.AUTH.LOGOUT_ALL, protect, logoutAll);

router.get(ROUTES.AUTH.SESSIONS, protect, getActiveSessions);

router.delete(ROUTES.AUTH.REVOKE_SESSION, protect, revokeSession);
router.post(
  ROUTES.AUTH.UPLOAD_IMAGE,
  protect,
  uploadLimiter,
  upload.single("image"),
  uploadImage
);

router.post(
  ROUTES.AUTH.UPLOAD_RESUME,
  protect,
  uploadLimiter,
  upload.single("resume"),
  uploadResume
);

export default router;
