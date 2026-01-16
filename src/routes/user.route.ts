import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  updateProfileSchema,
  deleteResumeSchema,
  getPublicProfileSchema,
} from "../validators/user.validator";
import {
  updateProfile,
  deleteResume,
  getPublicProfile,
} from "../controllers/user.controller";
import { ROUTES } from "../constants/routes";

const router = Router();

router.put(
  ROUTES.USERS.UPDATE_PROFILE,
  protect,
  validate(updateProfileSchema),
  updateProfile
);
router.delete(
  ROUTES.USERS.DELETE_RESUME,
  protect,
  validate(deleteResumeSchema),
  deleteResume
);

router.get(
  ROUTES.USERS.BY_ID,
  validate(getPublicProfileSchema),
  getPublicProfile
);

export default router;
