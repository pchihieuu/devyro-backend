import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  applyToJobSchema,
  getApplicantsSchema,
  getApplicationByIdSchema,
  updateApplicationStatusSchema,
} from "../validators/application.validator";
import {
  applyToJob,
  getMyApplications,
  getApplicantsForJob,
  getApplicationById,
  updateStatus,
  withdrawApplication,
} from "../controllers/application.controller";
import { ROUTES } from "../constants/routes";

const router = Router();

// Protected routes
router.post(
  ROUTES.APPLICATIONS.APPLY_JOB,
  protect,
  validate(applyToJobSchema),
  applyToJob
);

router.get(ROUTES.APPLICATIONS.MY, protect, getMyApplications);

router.get(
  ROUTES.APPLICATIONS.JOB_APPLICATIONS,
  protect,
  validate(getApplicantsSchema),
  getApplicantsForJob
);

router.get(
  ROUTES.APPLICATIONS.BY_ID,
  protect,
  validate(getApplicationByIdSchema),
  getApplicationById
);

router.put(
  ROUTES.APPLICATIONS.UPDATE_STATUS,
  protect,
  validate(updateApplicationStatusSchema),
  updateStatus
);

router.delete(ROUTES.APPLICATIONS.WITH_DRAW, protect, withdrawApplication);

export default router;
