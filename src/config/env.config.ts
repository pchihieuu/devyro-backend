import * as dotenv from "dotenv";


dotenv.config();

interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

interface AppConfig {
  database: DatabaseConfig;
  nodeEnv: string;
  port: number;
}

const validateEnv = (): void => {
  const required = ["DB_PASSWORD", "DB_DATABASE"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

validateEnv();

export const config: AppConfig = {
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD as string,
    database: process.env.DB_DATABASE as string,
  },
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "5000", 10),
};