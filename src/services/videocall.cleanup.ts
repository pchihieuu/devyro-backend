import { videoCallService } from "./videocall.service";

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startCallCleanupJob(): void {
  if (cleanupInterval) return; // Prevent double-start

  console.log("[CallCleanup] Job started — interval: 60s");

  cleanupInterval = setInterval(async () => {
    try {
      await videoCallService.cleanupStalePendingCalls();
    } catch (err) {
      console.error("[CallCleanup] Error:", err);
    }
  }, 60_000);

  // Run immediately on startup
  videoCallService.cleanupStalePendingCalls().catch((err) => {
    console.error("[CallCleanup] Initial cleanup error:", err);
  });
}

export function stopCallCleanupJob(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log("[CallCleanup] Job stopped");
  }
}