import { prisma } from "../lib/prisma";
import { syncGoogleSheet } from "../utils/sheetSyncHelper";

/**
 * Background service to periodically sync connected Google Sheets
 * This should be called every minute to check for sheets that need syncing
 */
export async function runSheetSyncScheduler() {
  try {
    const activeSyncs = await prisma.googleSheetSync.findMany({
      where: {
        isActive: true,
      },
    });

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
  } catch (error) {
    console.error("Sheet sync scheduler error:", error);
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

