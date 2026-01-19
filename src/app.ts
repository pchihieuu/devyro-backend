import "reflect-metadata";
import express, { Application } from "express";
import cors from "cors";
import authRoutes from "./routes/auth.route";
import userRoutes from "./routes/user.route";
import jobRoutes from "./routes/job.route";
import applicationRoutes from "./routes/application.route";
import analyticsRoutes from "./routes/analytics.route";
import savedJobRoutes from "./routes/savedJob.route";
import companyRoutes from "./routes/company.route";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { API_PREFIX, ROUTES } from "./constants/routes";

const app: Application = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Job Portal API is running",
    version: "1.0.0",
  });
});

app.use(`${API_PREFIX}${ROUTES.AUTH.BASE}`, authRoutes);
app.use(`${API_PREFIX}${ROUTES.USERS.BASE}`, userRoutes);
app.use(`${API_PREFIX}${ROUTES.JOBS.BASE}`, jobRoutes);
app.use(`${API_PREFIX}${ROUTES.APPLICATIONS.BASE}`, applicationRoutes);
app.use(`${API_PREFIX}${ROUTES.SAVED_JOBS.BASE}`, savedJobRoutes);
app.use(`${API_PREFIX}${ROUTES.ANALYTICS.BASE}`, analyticsRoutes);
app.use(`${API_PREFIX}${ROUTES.COMPANIES.BASE}`, companyRoutes);
app.use(notFoundHandler);

app.use(errorHandler);

export default app;
