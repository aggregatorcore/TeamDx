/**
 * Senior overdue notification cron: when lead becomes overdue (callbackAt < now),
 * notify TL/BM once per lead per 24h (lead:overdue_telecaller_missed).
 */

import cron from "node-cron";
import { runSeniorOverdueNotifications } from "../services/seniorOverdueNotificationService";

cron.schedule("*/15 * * * *", async () => {
  console.log("[CRON] Running senior overdue notifications...");
  try {
    const { notified, errors } = await runSeniorOverdueNotifications();
    if (notified > 0) {
      console.log(`[CRON] Senior overdue: ${notified} lead(s) notified`);
    }
    if (errors.length > 0) {
      console.error("[CRON] Senior overdue errors:", errors);
    }
  } catch (error: any) {
    console.error("[CRON] Senior overdue notifications failed:", error);
  }
});

console.log("[CRON] Senior overdue notification cron scheduled (every 15 min)");
