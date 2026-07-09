import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
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
  .post(protect, validate(createJobSchema), createJob)
  .get(validate(getJobsSchema), getJobs);

router
  .route(ROUTES.JOBS.BY_ID)
  .get(validate(getJobByIdSchema), getJobById)
  .put(protect, validate(updateJobSchema), updateJob)
  .delete(protect, validate(jobIdParamSchema), deleteJob);

export default router;
