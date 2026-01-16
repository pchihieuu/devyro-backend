import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  authLimiter,
  uploadLimiter,
} from "../middlewares/rateLimiter.middleware";
import { registerSchema, loginSchema } from "../validators/auth.validator";
import {
  register,
  login,
  getMe,
  uploadImage,
  uploadResume,
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

router.get(ROUTES.AUTH.ME, protect, getMe);

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
