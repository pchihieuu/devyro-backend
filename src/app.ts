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
import notificationRoutes from "./routes/notification.route";
import chatRoutes from "./routes/chat.routes";
import blogRoutes from "./routes/blog.route";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { API_PREFIX, ROUTES } from "./constants/routes";
import helmet from "helmet";
import { config } from "./config/env.config";
import cookieParser from "cookie-parser";

const app: Application = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
        connectSrc: ["'self'", config.frontendUrl],
      },
    },
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = Array.isArray(config.cors.origin)
        ? config.cors.origin
        : [config.cors.origin];

      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, origin);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["set-cookie"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(cookieParser());

app.set("trust proxy", 1);

app.get(`${API_PREFIX}${ROUTES.HEALTH.CHECK}`, (req, res) => {
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
app.use(`${API_PREFIX}${ROUTES.NOTIFICATIONS.BASE}`, notificationRoutes);
app.use(`${API_PREFIX}${ROUTES.CHAT.BASE}`, chatRoutes);
app.use(`${API_PREFIX}${ROUTES.BLOGS.BASE}`, blogRoutes);
app.use(notFoundHandler);

app.use(errorHandler);

export default app;
