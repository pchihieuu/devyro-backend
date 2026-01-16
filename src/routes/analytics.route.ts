import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { getEmployerAnalytics } from "../controllers/analytics.controller";
import { ROUTES } from "../constants/routes";

const router = Router();

// Protected route
router.get(ROUTES.ANALYTICS.OVERVIEW, protect, getEmployerAnalytics);

export default router;
