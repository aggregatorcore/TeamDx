/**
 * Auto-escalation cron (Model B): no_answer + RED + overdue >= 48h
 * Runs every hour; moves lead to TL/Manager, notifies, logs AUTO_ESCALATED_OVERDUE_48H
 * (24h = senior alert + Escalation Required flag only — see seniorOverdueCron)
 */

import cron from "node-cron";
import { runAutoEscalationOverdue48h } from "../services/autoEscalationService";

cron.schedule("0 * * * *", async () => {
  console.log("[CRON] Running auto-escalation (no_answer overdue 48h)...");
  try {
    const { escalated, errors } = await runAutoEscalationOverdue48h();
    if (escalated > 0) {
      console.log(`[CRON] Auto-escalation: ${escalated} lead(s) escalated`);
    }
    if (errors.length > 0) {
      console.error("[CRON] Auto-escalation errors:", errors);
    }
  } catch (error: any) {
    console.error("[CRON] Auto-escalation failed:", error);
  }
});

console.log("[CRON] Auto-escalation cron scheduled (runs every hour)");
