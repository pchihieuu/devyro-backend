import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  saveJobSchema,
  unsaveJobSchema,
} from "../validators/savedJob.validator";
import {
  saveJob,
  unsaveJob,
  getMySavedJobs,
} from "../controllers/savedJob.controller";
import { ROUTES } from "../constants/routes";

const router = Router();

router.post(ROUTES.SAVED_JOBS.BY_ID, protect, validate(saveJobSchema), saveJob);
router.delete(
  ROUTES.SAVED_JOBS.BY_ID,
  protect,
  validate(unsaveJobSchema),
  unsaveJob
);
router.get(ROUTES.SAVED_JOBS.MY, protect, getMySavedJobs);

export default router;
