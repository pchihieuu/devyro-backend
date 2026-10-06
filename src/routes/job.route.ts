import { Router } from "express";
import { optionalAuth, protect } from "../middlewares/auth.middleware";
import {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
  toggleCloseJob,
  getJobsEmployer,
} from "../controllers/job.controller";
import { ROUTES } from "../constants/routes";
import {
  createJobSchema,
  employerJobsQuerySchema,
  getJobByIdSchema,
  getJobsSchema,
  jobIdParamSchema,
  updateJobSchema,
} from "../validators/job.validator";
import { validate } from "../middlewares/validation.middleware";
import { idempotency } from "../middlewares/idempotency.middleware";

const router = Router();

router.get(
  ROUTES.JOBS.EMPLOYER_JOBS,
  protect,
  validate(employerJobsQuerySchema),
  getJobsEmployer
);

router.patch(
  ROUTES.JOBS.TOGGLE_CLOSE,
  protect,
  validate(jobIdParamSchema),
  toggleCloseJob
);

router
  .route("/")
  .post(protect, idempotency(), validate(createJobSchema), createJob)
  .get(optionalAuth, validate(getJobsSchema), getJobs);

router
  .route(ROUTES.JOBS.BY_ID)
  .get(optionalAuth, validate(getJobByIdSchema), getJobById)
  .put(protect, validate(updateJobSchema), updateJob)
  .delete(protect, validate(jobIdParamSchema), deleteJob);

export default router;
