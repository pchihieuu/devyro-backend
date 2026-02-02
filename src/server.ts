import dotenv from "dotenv";
dotenv.config();

import "reflect-metadata";
import app from "./app";
import {
  closeDatabase,
  initializeDatabase,
} from "./config/database.initializer";
import { initializeWebSocket } from "./services/websocket.service";
import { createServer } from "http";
import { setupScheduledJobs } from "./jobs/scheduledJobs";

const PORT = process.env.PORT || 5000;

const httpServer = createServer(app);

const startServer = async () => {
  try {
    await initializeDatabase();
    setupScheduledJobs();

    initializeWebSocket(httpServer);
    console.log("WebSocket initialized successfully");

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`WebSocket server is ready`);
    });

    const gracefulShutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);

      httpServer.close(async () => {
        console.log("HTTP server closed.");

        try {
          await closeDatabase();
          console.log("Shutdown complete. Exiting now.");
          process.exit(0);
        } catch (error) {
          console.error("Error during shutdown:", error);
          process.exit(1);
        }
      });

      setTimeout(() => {
        console.error("⚠️ Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
