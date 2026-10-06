import { Router } from "express";
import { idempotency } from "../middlewares/idempotency.middleware";
import { protect } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  applyToJobSchema,
  getApplicantsSchema,
  getApplicationByIdSchema,
  getMyApplicationsSchema,
  updateApplicationStatusSchema,
} from "../validators/application.validator";
import {
  applyToJob,
  getMyApplications,
  getApplicantsForJob,
  getApplicationById,
  updateStatus,
  withdrawApplication,
  triggerAIAnalysis,
} from "../controllers/application.controller";
import { ROUTES } from "../constants/routes";

const router = Router();

// Protected routes
router.post(
  ROUTES.APPLICATIONS.APPLY_JOB,
  protect,
  idempotency(),
  validate(applyToJobSchema),
  applyToJob
);

router.get(
  ROUTES.APPLICATIONS.MY,
  protect,
  validate(getMyApplicationsSchema),
  getMyApplications
);

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

router.delete(
  ROUTES.APPLICATIONS.WITH_DRAW,
  protect,
  validate(getApplicationByIdSchema),
  withdrawApplication
);

router.post(
  ROUTES.APPLICATIONS.ANALYZE,
  protect,
  validate(getApplicationByIdSchema),
  triggerAIAnalysis
);

export default router;
