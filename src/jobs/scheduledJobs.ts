import cron from "node-cron";
import { authService } from "../services/auth.service";

/**
 * Setup scheduled jobs
 */
export const setupScheduledJobs = () => {
  // Run cleanup every day at 2:00 AM
  cron.schedule("0 2 * * *", async () => {
    console.log("Running scheduled cleanup job for expired tokens...");
    
    try {
      // Refresh session (Redis) tự hết hạn qua TTL — không cần cron dọn nữa.

      // Clean up expired password reset tokens
      await authService.cleanupExpiredResetTokens();
      console.log("Expired password reset tokens cleaned up successfully");
    } catch (error) {
      console.error("Error during cleanup job:", error);
    }
  });

  console.log("Scheduled jobs initialized");
};