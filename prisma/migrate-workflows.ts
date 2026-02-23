import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Create PostgreSQL connection pool
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const isSupabase = connectionString.includes("supabase");
const pool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

/**
 * Migration script to update old workflow canvas data to new structure
 * This script:
 * 1. Clears old unwanted nodes/edges from workflows
 * 2. Ensures workflows have the new structure (navigation, subButtons, tagGroups, tags)
 * 3. Resets canvas to empty state
 */
async function migrateWorkflows() {
  try {
    console.log("🔄 Starting workflow data migration...");

    const workflows = await prisma.workflow.findMany({
      select: {
        id: true,
        name: true,
        workflowData: true,
        version: true,
      },
    });

    console.log(`📊 Found ${workflows.length} workflows to migrate`);

    let updatedCount = 0;

    for (const workflow of workflows) {
      try {
        let parsedData: any = {};
        
        // Parse existing workflow data
        if (workflow.workflowData) {
          try {
            parsedData = typeof workflow.workflowData === 'string' 
              ? JSON.parse(workflow.workflowData) 
              : workflow.workflowData;
          } catch (e) {
            console.warn(`⚠️  Failed to parse workflow ${workflow.id}, using default structure`);
            parsedData = {};
          }
        }

        // Create new structure with default values
        const newWorkflowData = {
          name: parsedData.name || workflow.name || "Lead Workflow",
          description: parsedData.description || "Lead management workflow",
          navigation: parsedData.navigation || {
            enabled: true,
            visibleRoles: ["TELECALLER", "COUNSELOR"],
            entryPoints: ["leads_page", "lead_detail", "call_detail"],
          },
          controlButtons: parsedData.controlButtons || [],
          subButtons: parsedData.subButtons || [
            {
              id: "connected",
              label: "Connected",
              color: "#10b981",
              order: 1,
              enabled: true,
            },
            {
              id: "not_connected",
              label: "Not Connected",
              color: "#ef4444",
              order: 2,
              enabled: true,
            },
          ],
          tagGroups: parsedData.tagGroups || {
            connected: [
              { id: "interested", name: "Interested", color: "#10b981" },
              { id: "discussion", name: "Discussion", color: "#3b82f6" },
              { id: "processing", name: "Processing", color: "#8b5cf6" },
              { id: "not_interested", name: "Not Interested", color: "#ef4444" },
            ],
            notConnected: [
              { id: "no_answer", name: "No Answer", color: "#f59e0b" },
              { id: "busy", name: "Busy", color: "#f97316" },
              { id: "switch_off", name: "Switch Off", color: "#6b7280" },
              { id: "invalid", name: "Invalid", color: "#dc2626" },
            ],
          },
          tags: parsedData.tags || {},
          // Clear old canvas nodes/edges - start with empty canvas
          nodes: [],
          edges: [],
          version: parsedData.version || workflow.version || 1,
          status: parsedData.status || "draft",
        };

        // Update workflow in database
        await prisma.workflow.update({
          where: { id: workflow.id },
          data: {
            workflowData: JSON.stringify(newWorkflowData),
            version: (workflow.version || 1) + 1, // Increment version
            updatedAt: new Date(),
          },
        });

        updatedCount++;
        console.log(`✅ Updated workflow: ${workflow.name} (${workflow.id})`);
      } catch (error: any) {
        console.error(`❌ Error updating workflow ${workflow.id}:`, error.message);
      }
    }

    console.log(`\n✨ Migration complete!`);
    console.log(`📈 Updated ${updatedCount} out of ${workflows.length} workflows`);
    console.log(`🎨 All workflows now have new structure with empty canvas`);
  } catch (error: any) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
if (require.main === module) {
  migrateWorkflows()
    .then(() => {
      console.log("✅ Migration script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Migration script failed:", error);
      process.exit(1);
    });
}

export { migrateWorkflows };
