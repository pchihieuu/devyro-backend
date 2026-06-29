import dotenv from "dotenv";
dotenv.config();

import "reflect-metadata";
import app from "./app";
import {
  closeDatabase,
  initializeDatabase,
} from "./config/database.initializer";
import { initializeWebSocket } from "./services/websocket.service";
import { mqService } from "./services/message-queue.service";
import { startAllWorkers } from "./workers/chat";
import { createServer } from "http";
import { setupScheduledJobs } from "./jobs/scheduledJobs";

const PORT = process.env.PORT || 5000;

const httpServer = createServer(app);

const startServer = async () => {
  try {
    await initializeDatabase();
    console.log("Database initialized");

    // 2. Kết nối RabbitMQ — phải xong trước khi start workers
    await mqService.connectWithRetry(10, 3000);
    console.log("RabbitMQ connected");

    // 3. WebSocket service — workers cần getWebSocketService()
    initializeWebSocket(httpServer);
    console.log("WebSocket initialized");

    // 4. Start tất cả consumer workers
    await startAllWorkers();

    // 5. Scheduled jobs
    setupScheduledJobs();

    // 6. Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);

      httpServer.close(async () => {
        console.log("HTTP server closed.");

        try {
          // Đóng MQ trước để workers không nhận message mới
          await mqService.close();
          await closeDatabase();
          console.log("Shutdown complete.");
          process.exit(0);
        } catch (error) {
          console.error("Error during shutdown:", error);
          process.exit(1);
        }
      });

      // Force kill sau 10s nếu shutdown bị kẹt
      setTimeout(() => {
        console.error("Forced shutdown after timeout");
        process.exit(1);
      }, 10_000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Bắt unhandled rejection để không crash server im lặng
    process.on("unhandledRejection", (reason) => {
      console.error("Unhandled Rejection:", reason);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
