import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  createCompanySchema,
  updateCompanySchema,
  getCompanyByIdSchema,
  getCompanyJobsSchema,
  getAllCompaniesSchema,
} from "../validators/company.validator";
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  getMyCompany,
  getCompanyJobs,
  updateCompany,
  deleteCompany,
  uploadCompanyLogo,
} from "../controllers/company.controller";
import { ROUTES } from "../constants/routes";
import { uploadLimiter } from "../middlewares/rateLimiter.middleware";
import upload from "../middlewares/upload.middleware";

const router = Router();

// Public routes
router.get("/", validate(getAllCompaniesSchema), getAllCompanies);

router.get(ROUTES.COMPANIES.MY, protect, getMyCompany);

router.get(
  ROUTES.COMPANIES.JOBS,
  validate(getCompanyJobsSchema),
  getCompanyJobs
);

router.get(
  ROUTES.COMPANIES.BY_ID,
  validate(getCompanyByIdSchema),
  getCompanyById
);

// Protected routes
router.post("/", protect, validate(createCompanySchema), createCompany);

router.put(
  ROUTES.COMPANIES.BY_ID,
  protect,
  validate(updateCompanySchema),
  updateCompany
);

router.delete(ROUTES.COMPANIES.BY_ID, protect, validate(getCompanyByIdSchema), deleteCompany);

router.post(
  ROUTES.COMPANIES.UPLOAD_LOGO,
  protect,
  uploadLimiter,
  upload.single("image"),
  uploadCompanyLogo
);

export default router;
