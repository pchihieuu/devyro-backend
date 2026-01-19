import * as dotenv from "dotenv";
dotenv.config();

import { DataSource } from "typeorm";
import { User } from "../entities/User.entity";
import { Job } from "../entities/Job.entity";
import { Application } from "../entities/Application.entity";
import { SavedJob } from "../entities/SavedJob.entity";
import { Analytics } from "../entities/Analytics.entity";
import { Company } from "../entities/Company.entity";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: false,
  logging: true,
  entities: [User, Job, Application, SavedJob, Analytics, Company],
  migrations: ["src/migrations/*.ts"],
  migrationsTableName: "migrations",
  subscribers: [],
});

export const initializeDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Error connecting to database:", error);
    process.exit(1);
  }
};
