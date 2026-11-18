/**
 * PHẢI là import ĐẦU TIÊN của runner (trước mọi import từ `src/`), vì
 * `src/config/*` đọc process.env ngay lúc được import.
 *
 * Nguyên tắc: verify KHÔNG BAO GIỜ kế thừa cấu hình dev từ `.env`.
 *  - Nạp `.env.test` (nếu có). Biến đã đặt ở shell thắng `.env.test`.
 *  - Kết nối DB/Redis phải được khai báo TƯỜNG MINH (không thiếu cái nào) —
 *    nếu thiếu, `src/config/env.config.ts` sẽ âm thầm nạp tiếp từ `.env`
 *    (thường là DB dev) và verify sẽ "lẫn" cấu hình dev với cấu hình test.
 *  - Các dịch vụ bên ngoài (Sentry, OTel, SMTP, Cloudinary) bị vô hiệu hoá
 *    cưỡng bức để test không bao giờ gửi dữ liệu thật ra ngoài.
 */
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

const root = path.resolve(__dirname, "../..");
const envFile = path.join(root, ".env.test");
export const loadedEnvFile = fs.existsSync(envFile) ? envFile : null;
if (loadedEnvFile) dotenv.config({ path: loadedEnvFile });

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run verify with NODE_ENV=production.");
  process.exit(2);
}
process.env.NODE_ENV = process.env.NODE_ENV || "test";

const REQUIRED_EXPLICIT = [
  "DB_HOST",
  "DB_PORT",
  "DB_USERNAME",
  "DB_PASSWORD",
  "DB_DATABASE",
  "REDIS_URL",
] as const;

export const missingExplicit = REQUIRED_EXPLICIT.filter(
  (k) => !process.env[k]
);

/* Cưỡng bức vô hiệu hoá dịch vụ ngoài (kể cả khi .env/shell có đặt)*/
Object.assign(process.env, {
  DATABASE_URL: "", // for use only in production config; never for verification
  SENTRY_DSN: "",
  OTEL_EXPORTER_OTLP_ENDPOINT: "",
  METRICS_TOKEN: "",
  EMAIL_USER: "",
  EMAIL_PASSWORD: "",
  EMAIL_HOST: "127.0.0.1", // closed port: never actually touches SMTP
  EMAIL_PORT: "1",
  CLOUDINARY_CLOUD_NAME: "",
  CLOUDINARY_API_KEY: "",
  CLOUDINARY_API_SECRET: "",
  DB_LOGGING: process.env.DB_LOGGING || "false",
});

/* Giá trị mặc định cho biến bắt buộc nhưng verify không dùng thật */
process.env.JWT_SECRET ||= "verify-jwt-secret";
process.env.JWT_REFRESH_SECRET ||= "verify-jwt-refresh-secret";
process.env.GEMINI_API_KEY ||= "verify-not-a-real-key";
process.env.RABBITMQ_URL ||= "amqp://127.0.0.1:1"; 
process.env.CLIENT_URL ||= "http://localhost:5173";
process.env.CORS_ORIGIN = process.env.CLIENT_URL;
