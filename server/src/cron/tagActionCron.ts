/**
 * Cron job for tag action runner
 * Runs every 30 seconds to process due tag action instances
 */

import cron from "node-cron";
import { runTagActionRunner } from "../services/tagActionRunner";

// Run every 30 seconds: "*/30 * * * * *" (seconds, minutes, hours, day, month, weekday)
// For node-cron, we use the 6-field format with seconds
cron.schedule("*/30 * * * * *", async () => {
  console.log("[CRON] Running tag action runner...");
  try {
    await runTagActionRunner();
    console.log("[CRON] Tag action runner completed");
  } catch (error: any) {
    console.error("[CRON] Error in tag action runner:", error);
    // Don't throw - cron errors shouldn't crash the server
  }
});

console.log("[CRON] Tag action cron job scheduled (runs every 30 seconds)");
