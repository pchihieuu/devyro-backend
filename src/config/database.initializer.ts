import { AppDataSource } from "./database.config";

export const initializeDatabase = async (): Promise<void> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log("Database connected successfully");
      console.log(`Database: ${AppDataSource.options.database}`);
    } else {
      console.log("Database already initialized");
    }
  } catch (error) {
    console.error("Error connecting to database:", error);
    throw error;
  }
};

export const closeDatabase = async (): Promise<void> => {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log("🔌 Database connection closed");
    }
  } catch (error) {
    console.error("Error closing database:", error);
    throw error;
  }
};
