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

const router = Router();

router.get(ROUTES.JOBS.EMPLOYER_JOBS, protect, getJobsEmployer);

router.route("/").post(protect, createJob).get(getJobs);

router
  .route(ROUTES.JOBS.BY_ID)
  .get(getJobById)
  .put(protect, updateJob)
  .delete(protect, deleteJob);

router.put(ROUTES.JOBS.TOGGLE_CLOSE, protect, toggleCloseJob);

export default router;
