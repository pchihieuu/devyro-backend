import { DataSource, DataSourceOptions } from "typeorm";
import { config } from "./env.config";
import { User } from "../entities/User.entity";
import { Job } from "../entities/Job.entity";
import { Application } from "../entities/Application.entity";
import { SavedJob } from "../entities/SavedJob.entity";
import { Analytics } from "../entities/Analytics.entity";
import { Company } from "../entities/Company.entity";
import { Notification } from "../entities/Notification.entity";
import { RefreshToken } from "../entities/Refreshtoken.entity";
import { PasswordResetToken } from "../entities/Passwordresettoken.entity";

const isProduction = config.nodeEnv === "production";

const baseConfig: Partial<DataSourceOptions> = {
  type: "postgres",
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.database,
  synchronize: false,
  logging: !isProduction,
  migrationsTableName: "migrations",
  subscribers: [],
};

const developmentConfig: DataSourceOptions = {
  ...baseConfig,
  entities: [
    User,
    Job,
    Application,
    SavedJob,
    Analytics,
    Company,
    Notification,
    RefreshToken,
    PasswordResetToken,
  ],
  migrations: ["src/migrations/**/*.ts"],
} as DataSourceOptions;

const productionConfig: DataSourceOptions = {
  ...baseConfig,
  entities: ["dist/entities/**/*.entity.js"],
  migrations: ["dist/migrations/**/*.js"],
} as DataSourceOptions;

export const AppDataSource = new DataSource(
  isProduction ? productionConfig : developmentConfig
);

export const isDatabaseConnected = (): boolean => {
  return AppDataSource.isInitialized;
};
