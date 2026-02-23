/**
 * Cron job for overdue task checks
 * Runs every hour to tag overdue tasks and escalate priorities
 */

import cron from "node-cron";
import {
  tagOverdueTasks,
  escalateOverdueTasks,
} from "../services/taskOverdueService";

// Run every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
cron.schedule("0 * * * *", async () => {
  console.log("[CRON] Running overdue task checks...");
  try {
    await tagOverdueTasks();
    await escalateOverdueTasks();
    console.log("[CRON] Overdue task checks completed");
  } catch (error) {
    console.error("[CRON] Error in overdue task checks:", error);
  }
});

console.log("[CRON] Task overdue cron job scheduled (runs every hour)");
