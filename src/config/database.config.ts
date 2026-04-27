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
import { Message } from "../entities/Message.entity";
import { Conversation } from "../entities/Conversation.entity";
import { BlogCategory } from "../entities/BlogCategory.entity";
import { BlogPost } from "../entities/BlogPost.entity";
import { BlogPostView } from "../entities/BlogPostView.entity";
import { BlogTag } from "../entities/BlogTag.entity";
import { VideoCall } from "../entities/Videocall.entity";
import { CallParticipant } from "../entities/CallParticipant.entity";

const isProduction = config.nodeEnv === "production";

if (process.env.DATABASE_URL) {
  const maskedUrl = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ":****@");
  console.log("DATABASE_URL (masked):", maskedUrl);
}
console.log("DB_HOST:", config.database.host);
console.log("DB_PORT:", config.database.port);
console.log("DB_USERNAME:", config.database.username);
console.log("DB_DATABASE:", config.database.database);

const baseConfig: Partial<DataSourceOptions> = {
  type: "postgres",
  synchronize: false,
  logging: !isProduction,
  migrationsTableName: "migrations",
  subscribers: [],
};

const developmentConfig: DataSourceOptions = {
  ...baseConfig,
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.database,
  ssl: false,
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
    Message,
    Conversation,
    BlogCategory,
    BlogPost,
    BlogPostView,
    BlogTag,
    VideoCall,
    CallParticipant,
  ],
  migrations: ["src/migrations/**/*.ts"],
} as DataSourceOptions;

const productionConfig: DataSourceOptions = {
  ...baseConfig,
  ...(process.env.DATABASE_URL
    ? {
        url: process.env.DATABASE_URL,
      }
    : {
        host: config.database.host,
        port: config.database.port,
        username: config.database.username,
        password: config.database.password,
        database: config.database.database,
      }),
  ssl: {
    rejectUnauthorized: false,
  },
  extra: {
    connectionTimeoutMillis: 30000,
    query_timeout: 30000,
    statement_timeout: 30000,
    max: 10,
    idleTimeoutMillis: 30000,
  },
  entities: ["dist/entities/**/*.entity.js"],
  migrations: ["dist/migrations/**/*.js"],
} as DataSourceOptions;

console.log("Using config:", isProduction ? "PRODUCTION" : "DEVELOPMENT");

export const AppDataSource = new DataSource(
  isProduction ? productionConfig : developmentConfig
);

export const isDatabaseConnected = (): boolean => {
  return AppDataSource.isInitialized;
};
