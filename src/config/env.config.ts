import * as dotenv from "dotenv";
dotenv.config();

interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

interface JwtConfig {
  secret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshTokenExpiresIn: string;
  expiresIn: string;
}

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

interface GeminiApi {
  apiKey: string;
}

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  fromName: string;
}

interface CorsConfig {
  origin: string;
  credentials: boolean;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

interface ApiConfig {
  version: string;
  prefix: string;
}

interface UploadConfig {
  maxFileSize: number;
  allowedImageTypes: string[];
  allowedResumeTypes: string[];
}

interface RMQConfig {
  url: string;
}

interface RedisConfig {
  url: string;
  tls: boolean;
}

/**
 * Timeout (ms) cho external call. Không có giá trị này, Cloudinary/SMTP treo
 * sẽ giữ request (và socket) vô thời hạn.
 */
interface TimeoutConfig {
  cloudinaryMs: number;
  emailMs: number;
}

/**
 * Tài liệu OpenAPI (Swagger UI). Mặc định BẬT ở dev, TẮT ở production trừ khi
 * DOCS_ENABLED=true; nên kèm DOCS_BASIC_AUTH="user:pass" khi bật ở production.
 */
interface DocsConfig {
  enabled: boolean;
  basicAuth?: string;
  /** Origin công khai của API, dùng làm `servers[0].url` trong tài liệu. */
  publicUrl?: string;
}

interface AppConfig {
  docs: DocsConfig;
  timeouts: TimeoutConfig;
  database: DatabaseConfig;
  jwt: JwtConfig;
  cloudinary: CloudinaryConfig;
  email: EmailConfig;
  cors: CorsConfig;
  rmq: RMQConfig;
  redis: RedisConfig;
  rateLimit: RateLimitConfig;
  api: ApiConfig;
  upload: UploadConfig;
  nodeEnv: string;
  port: number;
  clientUrl: string;
  frontendUrl: string;
  cookieDomain?: string;
  gemini: GeminiApi;
}

const validateEnv = (): void => {
  const required = [
    // "DB_PASSWORD",
    // "DB_DATABASE",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "GEMINI_API_KEY",
    "RABBITMQ_URL",
    "REDIS_URL",
  ];
  if (!process.env.DATABASE_URL) {
    required.push("DB_PASSWORD", "DB_DATABASE");
  }
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

validateEnv();

const positiveInt = (value: string | undefined, fallback: number): number => {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config: AppConfig = {
  docs: {
    enabled:
      process.env.DOCS_ENABLED !== undefined && process.env.DOCS_ENABLED !== ""
        ? process.env.DOCS_ENABLED === "true"
        : (process.env.NODE_ENV || "development") !== "production",
    basicAuth: process.env.DOCS_BASIC_AUTH || undefined,
    publicUrl: process.env.API_PUBLIC_URL || undefined,
  },
  timeouts: {
    cloudinaryMs: positiveInt(process.env.CLOUDINARY_TIMEOUT_MS, 60_000),
    emailMs: positiveInt(process.env.EMAIL_TIMEOUT_MS, 15_000),
  },
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD as string,
    database: process.env.DB_DATABASE as string,
  },
  jwt: {
    secret: process.env.JWT_SECRET as string,
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  },
  email: {
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    secure: process.env.EMAIL_SECURE === "true",
    user: process.env.EMAIL_USER || "",
    password: process.env.EMAIL_PASSWORD || "",
    from: process.env.EMAIL_FROM || "noreply@jobportal.com",
    fromName: process.env.EMAIL_FROM_NAME || "Job Portal",
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY as string,
  },
  cors: {
    origin:
      process.env.CORS_ORIGIN ||
      process.env.CLIENT_URL ||
      "https://devyro.vercel.app",
    credentials: true,
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
  },
  api: {
    version: process.env.API_VERSION || "v1",
    prefix: process.env.API_PREFIX || "/api/v1",
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "5242880", 10),
    allowedImageTypes: (
      process.env.ALLOWED_IMAGE_TYPES || "image/jpeg,image/png,image/jpg"
    ).split(","),
    allowedResumeTypes: (
      process.env.ALLOWED_RESUME_TYPES ||
      "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ).split(","),
  },
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "5000", 10),
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  cookieDomain: process.env.COOKIE_DOMAIN,
  rmq: {
    url: process.env.RABBITMQ_URL as string,
  },
  redis: {
    url: process.env.REDIS_URL as string,
    tls: process.env.REDIS_TLS === "true",
  },
};
