import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  updateProfileSchema,
  deleteResumeSchema,
  getPublicProfileSchema,
  getMyProfileSchema,
  searchUsersSchema,
  addExperienceSchema,
  updateExperienceSchema,
  deleteExperienceSchema,
  addProjectSchema,
  updateProjectSchema,
  deleteProjectSchema,
} from "../validators/user.validator";
import {
  updateProfile,
  deleteResume,
  getPublicProfile,
  getMyProfile,
  searchUsers,
  addExperience,
  updateExperience,
  deleteExperience,
  addProject,
  updateProject,
  deleteProject,
} from "../controllers/user.controller";
import { ROUTES } from "../constants/routes";

const router = Router();

router.get(
  ROUTES.USERS.SEARCH,
  protect,
  validate(searchUsersSchema),
  searchUsers
);

router.get(
  ROUTES.USERS.MY_PROFILE,
  protect,
  validate(getMyProfileSchema),
  getMyProfile
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

router.post(
  ROUTES.USERS.EXPERIENCE,
  protect,
  validate(addExperienceSchema),
  addExperience
);

router.put(
  ROUTES.USERS.EXPERIENCE_BY_INDEX,
  protect,
  validate(updateExperienceSchema),
  updateExperience
);

router.delete(
  ROUTES.USERS.EXPERIENCE_BY_INDEX,
  protect,
  validate(deleteExperienceSchema),
  deleteExperience
);

router.post(
  ROUTES.USERS.PROJECTS,
  protect,
  validate(addProjectSchema),
  addProject
);

router.put(
  ROUTES.USERS.PROJECT_BY_INDEX,
  protect,
  validate(updateProjectSchema),
  updateProject
);

router.delete(
  ROUTES.USERS.PROJECT_BY_INDEX,
  protect,
  validate(deleteProjectSchema),
  deleteProject
);

router.get(
  ROUTES.USERS.BY_ID,
  validate(getPublicProfileSchema),
  getPublicProfile
);

export default router;
