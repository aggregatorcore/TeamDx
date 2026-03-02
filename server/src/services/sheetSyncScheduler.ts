import { prisma } from "../lib/prisma";
import { syncGoogleSheet } from "../utils/sheetSyncHelper";

/**
 * Background service to periodically sync connected Google Sheets
 * This should be called every minute to check for sheets that need syncing
 */
function isDbUnreachable(err: any): boolean {
  const msg = err?.message ?? "";
  return err?.code === "ECONNREFUSED" || msg.includes("connect") || msg.includes("timed out") || msg.includes("timeout");
}

export async function runSheetSyncScheduler() {
  try {
    let activeSyncs: Awaited<ReturnType<typeof prisma.googleSheetSync.findMany>>;
    try {
      activeSyncs = await prisma.googleSheetSync.findMany({
        where: {
          isActive: true,
        },
      });
    } catch (dbErr: any) {
      if (isDbUnreachable(dbErr)) {
        console.warn("[sheetSync] DB not reachable (check DATABASE_URL). Skipping.");
        return;
      }
      throw dbErr;
    }

    const now = new Date();

    for (const sync of activeSyncs) {
      // Check if it's time to sync
      if (!sync.lastSyncedAt) {
        // First sync - do it immediately
        try {
          await syncGoogleSheet(sync.id);
          console.log(`✓ Synced sheet: ${sync.name || sync.sheetId}`);
        } catch (error: any) {
          console.error(`✗ Failed to sync sheet ${sync.name || sync.sheetId}:`, error.message);
        }
        continue;
      }

      const minutesSinceLastSync =
        (now.getTime() - sync.lastSyncedAt.getTime()) / (1000 * 60);

      if (minutesSinceLastSync >= sync.syncInterval) {
        try {
          const result = await syncGoogleSheet(sync.id);
          console.log(
            `✓ Synced sheet: ${sync.name || sync.sheetId} - ${result.imported} new lead(s)`
          );
        } catch (error: any) {
          console.error(`✗ Failed to sync sheet ${sync.name || sync.sheetId}:`, error.message);
        }
      }
    }
  } catch (error: any) {
    if (!isDbUnreachable(error)) console.error("Sheet sync scheduler error:", error?.message ?? error);
  }
}

// Run scheduler every minute
export function startSheetSyncScheduler() {
  console.log("🔄 Google Sheets sync scheduler started");
  
  // Run immediately on start
  runSheetSyncScheduler();

  // Then run every minute
  setInterval(() => {
    runSheetSyncScheduler();
  }, 60 * 1000); // 60 seconds
}

