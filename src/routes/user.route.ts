import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  updateProfileSchema,
  deleteResumeSchema,
  getPublicProfileSchema,
  searchUsersSchema,
} from "../validators/user.validator";
import {
  updateProfile,
  deleteResume,
  getPublicProfile,
  searchUsers,
} from "../controllers/user.controller";
import { ROUTES } from "../constants/routes";

const router = Router();

router.get(
  ROUTES.USERS.SEARCH,
  protect,
  validate(searchUsersSchema),
  searchUsers
);

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
