import { prisma } from "../lib/prisma";

/**
 * Sync function to fetch and import new leads from Google Sheet
 * Shared utility for both API routes and scheduler
 */
/**
 * Get original Google Sheet name from URL
 */
async function getSheetName(sheetUrl: string, sheetId: string): Promise<string> {
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

export async function syncGoogleSheet(syncId: string) {
  const sync = await prisma.googleSheetSync.findUnique({
    where: { id: syncId },
    include: {
      createdBy: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!sync || !sync.isActive) {
    throw new Error("Sync not found or inactive");
  }

  // Update sheet name if it's not set or is a default name
  if (!sync.name || sync.name.startsWith("Sheet ")) {
    try {
      const originalName = await getSheetName(sync.sheetUrl, sync.sheetId);
      if (originalName && originalName !== sync.name) {
        await prisma.googleSheetSync.update({
          where: { id: syncId },
          data: { name: originalName },
        });
        sync.name = originalName;
      }
    } catch (error) {
      // Silent fail - keep existing name
    }
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sync.sheetId}/export?format=csv&gid=0`;
  const response = await fetch(csvUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: ${response.status}`);
  }

  const csvText = await response.text();
  const lines = csvText.trim().split("\n");

  if (lines.length < 2) {
    await prisma.googleSheetSync.update({
      where: { id: syncId },
      data: {
        lastSyncedAt: new Date(),
        lastRowCount: lines.length - 1,
      },
    });
    return { imported: 0, total: 0, message: "Sheet is empty or has no data rows" };
  }

  // Parse header
  const rawHeaders = lines[0].split(",").map((h) => h.trim());
  const headers = rawHeaders.map((h) => h.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, ""));
  const headerMap: { [key: string]: number } = {};

  const fieldVariations: { [key: string]: string[] } = {
    firstname: ["firstname", "first", "fname", "first_name"],
    lastname: ["lastname", "last", "lname", "surname", "last_name"],
    email: ["email", "e-mail", "emailaddress", "email_address"],
    phone: ["phone", "phonenumber", "mobile", "contact", "phone_number", "tel"],
    country: ["country", "targetcountry", "destination", "target_country"],
    visatype: ["visatype", "visa", "visa_type", "visacategory"],
    source: ["source", "leadsource", "lead_source", "origin"],
    status: ["status", "leadstatus", "lead_status", "state"],
    notes: ["notes", "note", "comments", "remarks", "description"],
  };

  headers.forEach((h, i) => {
    for (const [fieldName, variations] of Object.entries(fieldVariations)) {
      if (variations.some((v) => h.includes(v) || v.includes(h))) {
        headerMap[fieldName] = i;
        break;
      }
    }
    headerMap[h] = i;
  });

  // Only process new rows
  const startRow = sync.lastRowCount > 0 ? sync.lastRowCount + 1 : 1;
  let imported = 0;
  const errors: string[] = [];

  for (let i = startRow; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV with quoted values
    const values: string[] = [];
    let currentValue = "";
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = "";
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());

    const getValue = (fieldName: string): string => {
      if (headerMap[fieldName] !== undefined) {
        return values[headerMap[fieldName]] || "";
      }
      return "";
    };

    try {
      const leadData = {
        firstName: getValue("firstname") || "",
        lastName: getValue("lastname") || "",
        email: getValue("email") || "",
        phone: getValue("phone") || "",
        country: getValue("country") || undefined,
        visaType: getValue("visatype") || undefined,
        source: getValue("source") || undefined,
        status: (getValue("status") || "new") as "new" | "contacted" | "qualified" | "converted" | "lost",
        notes: getValue("notes") || undefined,
      };

      if (!leadData.firstName || !leadData.lastName || !leadData.email || !leadData.phone) {
        continue;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(leadData.email)) {
        continue;
      }

      // Check if lead already exists (from this sync)
      const existingLead = await prisma.lead.findFirst({
        where: {
          email: leadData.email,
          sheetSyncId: syncId,
        },
      });

      if (existingLead) {
        continue; // Skip duplicates from this sheet
      }

      await prisma.lead.create({
        data: {
          ...leadData,
          createdById: sync.createdBy.id,
          sheetSyncId: syncId,
        },
      });

      imported++;
    } catch (error: any) {
      errors.push(`Row ${i + 1}: ${error.message || "Failed to create lead"}`);
    }
  }

  // Update sync record
  await prisma.googleSheetSync.update({
    where: { id: syncId },
    data: {
      lastSyncedAt: new Date(),
      lastRowCount: lines.length - 1,
    },
  });

  return {
    imported,
    total: lines.length - 1,
    newRows: lines.length - 1 - (sync.lastRowCount || 0),
    errors: errors.length > 0 ? errors : undefined,
  };
}

