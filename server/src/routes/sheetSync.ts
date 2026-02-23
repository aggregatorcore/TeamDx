import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/roleAuth";
import { syncGoogleSheet } from "../utils/sheetSyncHelper";

const router = Router();

// Validation schemas
const createSyncSchema = z.object({
  sheetUrl: z.string().url("Invalid Google Sheet URL"),
  name: z.string().optional(),
  syncInterval: z.number().min(1).max(60).default(5), // 1-60 minutes
});

/**
 * GET /api/sheet-sync
 * Get all connected Google Sheets (Admin only)
 */
router.get("/", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const syncs = await prisma.googleSheetSync.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ syncs });
  } catch (error) {
    console.error("Get sheet syncs error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/sheet-sync
 * Connect a new Google Sheet for live sync (Admin only)
 */
router.post("/", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const validatedData = createSyncSchema.parse(req.body);
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    // Extract sheet ID from URL
    const sheetIdMatch = validatedData.sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      return res.status(400).json({
        error: "Invalid Google Sheet URL format. Expected: https://docs.google.com/spreadsheets/d/SHEET_ID/edit",
      });
    }

    const sheetId = sheetIdMatch[1];

    // Check if sheet is already connected
    const existingSync = await prisma.googleSheetSync.findUnique({
      where: { sheetUrl: validatedData.sheetUrl },
    });

    if (existingSync) {
      return res.status(400).json({ error: "This Google Sheet is already connected" });
    }

    // Test if sheet is accessible and get original name
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
    let originalSheetName = validatedData.name || `Sheet ${sheetId.substring(0, 8)}`;
    
    try {
      // First, try to get the original sheet name from HTML
      try {
        const htmlResponse = await fetch(validatedData.sheetUrl);
        if (htmlResponse.ok) {
          const html = await htmlResponse.text();
          // Extract title from HTML
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            // Remove " - Google Sheets" suffix if present
            originalSheetName = titleMatch[1]
              .replace(/\s*-\s*Google\s+Sheets\s*$/i, "")
              .trim();
          }
        }
      } catch (htmlError) {
        // If HTML fetch fails, continue with default name
        console.log("Could not fetch sheet name from HTML, using default");
      }

      // Test CSV access
      const testResponse = await fetch(csvUrl);
      if (!testResponse.ok) {
        if (testResponse.status === 403) {
          return res.status(400).json({
            error: "Google Sheet is not publicly accessible. Please make the sheet public or use 'Anyone with the link can view' permission.",
          });
        }
        throw new Error(`Failed to access sheet: ${testResponse.status}`);
      }
    } catch (fetchError: any) {
      return res.status(400).json({
        error: "Failed to access Google Sheet",
        details: fetchError.message || "Please ensure the sheet is publicly accessible",
      });
    }

    // Create sync
    const sync = await prisma.googleSheetSync.create({
      data: {
        sheetUrl: validatedData.sheetUrl,
        sheetId,
        name: originalSheetName,
        syncInterval: validatedData.syncInterval,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Perform initial sync
    try {
      await syncGoogleSheet(sync.id);
    } catch (syncError) {
      console.error("Initial sync error:", syncError);
      // Don't fail the creation, just log the error
    }

    res.status(201).json({
      message: "Google Sheet connected successfully",
      sync,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Create sheet sync error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Helper function to get original Google Sheet name from URL
 */
async function getSheetNameFromUrl(sheetUrl: string, sheetId: string): Promise<string> {
  try {
    const htmlResponse = await fetch(sheetUrl);
    if (htmlResponse.ok) {
      const html = await htmlResponse.text();
      // Extract title from HTML
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        // Remove " - Google Sheets" suffix if present
        return titleMatch[1]
          .replace(/\s*-\s*Google\s+Sheets\s*$/i, "")
          .trim();
      }
    }
  } catch (error) {
    // If HTML fetch fails, return default
    console.log("Could not fetch sheet name from HTML");
  }
  return `Sheet ${sheetId.substring(0, 8)}`;
}

/**
 * POST /api/sheet-sync/:id/sync
 * Manually trigger sync for a sheet (Admin only)
 */
router.post("/:id/sync", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    const sync = await prisma.googleSheetSync.findUnique({
      where: { id },
    });

    if (!sync) {
      return res.status(404).json({ error: "Sheet sync not found" });
    }

    // Update sheet name if it's a default name
    if (!sync.name || sync.name.startsWith("Sheet ")) {
      try {
        const originalName = await getSheetNameFromUrl(sync.sheetUrl, sync.sheetId);
        if (originalName && originalName !== sync.name) {
          await prisma.googleSheetSync.update({
            where: { id },
            data: { name: originalName },
          });
        }
      } catch (error) {
        // Silent fail - keep existing name
      }
    }

    const result = await syncGoogleSheet(id);

    res.json({
      message: "Sync completed",
      ...result,
    });
  } catch (error) {
    console.error("Manual sync error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/sheet-sync/:id
 * Update sync settings (Admin only)
 */
router.put("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isActive, syncInterval } = req.body;

    const sync = await prisma.googleSheetSync.findUnique({
      where: { id },
    });

    if (!sync) {
      return res.status(404).json({ error: "Sheet sync not found" });
    }

    const updated = await prisma.googleSheetSync.update({
      where: { id },
      data: {
        name,
        isActive,
        syncInterval: syncInterval ? parseInt(syncInterval) : undefined,
      },
    });

    res.json({
      message: "Sync settings updated",
      sync: updated,
    });
  } catch (error) {
    console.error("Update sheet sync error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/sheet-sync/:id
 * Disconnect a Google Sheet (Admin only)
 */
router.delete("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    const sync = await prisma.googleSheetSync.findUnique({
      where: { id },
    });

    if (!sync) {
      return res.status(404).json({ error: "Sheet sync not found" });
    }

    await prisma.googleSheetSync.delete({
      where: { id },
    });

    res.json({ message: "Google Sheet disconnected successfully" });
  } catch (error) {
    console.error("Delete sheet sync error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

