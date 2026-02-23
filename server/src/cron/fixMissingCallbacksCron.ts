import cron from "node-cron";
import { fixMissingCallbacks } from "../jobs/fixMissingCallbacks";

/**
 * Cron job to automatically fix missing callbacks for "No Answer" tags
 * Runs every 5 minutes to ensure all tags have callbackAt set
 */
export function startFixMissingCallbacksCron() {
  // Run every 5 minutes
  const task = cron.schedule("*/5 * * * *", async () => {
    try {
      await fixMissingCallbacks();
    } catch (error: any) {
      console.error(`[FIX MISSING CALLBACKS CRON] ❌ Error in cron job:`, error.message);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  console.log("[cron] ✅ Fix missing callbacks cron job initialized (runs every 5 minutes)");
  
  // Run immediately on startup (don't wait 5 minutes)
  setTimeout(async () => {
    console.log("[cron] 🔄 Running initial fix missing callbacks check...");
    try {
      await fixMissingCallbacks();
    } catch (error: any) {
      console.error(`[FIX MISSING CALLBACKS CRON] ❌ Error in initial run:`, error.message);
    }
  }, 10000); // Wait 10 seconds after server starts

  return task;
}
