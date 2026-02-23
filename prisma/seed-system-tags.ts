import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const isSupabase = connectionString.includes("supabase");
const pool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// NO ANSWER System Tag with Pre-built Behavior Package
const NO_ANSWER_TAG = {
  id: "system_no_answer",
  tagKey: "no_answer",
  name: "No Answer",
  label: "No Answer",
  category: "notConnected",
  isSystem: true,
  deletable: false,
  editable: true,
  color: "#f59e0b",
  icon: "tag",
  displayOrder: 1,
  visibilityRoles: ["TELECALLER", "TEAM_LEADER", "BRANCH_MANAGER", "ADMIN"],
  // Pre-built Behavior Package
  tagConfig: {
    templateId: "T_NO_ANSWER",
    autoAction: "CALLBACK",
    retryPolicy: {
      attemptCountSource: "tagHistory",
      maxAttempts: 3,
      attemptTimings: [
        { attempt: 1, timing: "+60m", description: "+60 Minutes" },
        { attempt: 2, timing: "next_day", description: "Next Day" },
        { attempt: 3, timing: "+48h", description: "+48 Hours" },
      ],
    },
    overduePolicy: {
      popupAtSeconds: 30,
      remindAtMinutes: [15, 60],
      escalateAtHours: 24,
    },
    bucketBehavior: {
      onApply: "ORANGE",
      whenOverdue: "RED",
      onRetryClick: "ORANGE",
    },
    actionsShownOnLead: {
      whenOrange: {
        popupAtSeconds: 30,
        actions: ["Open", "Skip"],
      },
      whenRed: {
        actions: ["Retry Callback", "Escalate to Manager"],
        escalateCondition: "overdueAge >= 24h",
      },
    },
  },
};

async function seedSystemTags() {
  console.log("🌱 Seeding system tags...");

  try {
    // Get all workflows
    const workflows = await prisma.workflow.findMany();

    if (workflows.length === 0) {
      console.log("⚠️  No workflows found. Creating default workflow with NO ANSWER tag...");
      
      // Create a default workflow with NO ANSWER tag
      const defaultWorkflowData = {
        name: "Lead Workflow",
        description: "Lead management workflow",
        navigation: {
          enabled: true,
          visibleRoles: ["TELECALLER", "COUNSELOR"],
          entryPoints: ["leads_page", "lead_detail", "call_detail"],
        },
        subButtons: [
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
        tagGroups: {
          connected: [],
          notConnected: [NO_ANSWER_TAG],
        },
        tags: {
          [NO_ANSWER_TAG.id]: NO_ANSWER_TAG,
        },
        version: 1,
        status: "draft",
      };

      await prisma.workflow.create({
        data: {
          name: "Default Lead Workflow",
          description: "Default workflow with system tags",
          isActive: false,
          workflowData: JSON.stringify(defaultWorkflowData),
          version: 1,
        },
      });

      console.log("✅ Created default workflow with NO ANSWER system tag");
      return;
    }

    // Update existing workflows to include NO ANSWER tag if not present
    for (const workflow of workflows) {
      let workflowData: any;
      
      try {
        workflowData = typeof workflow.workflowData === 'string' 
          ? JSON.parse(workflow.workflowData) 
          : workflow.workflowData;
      } catch (error) {
        console.error(`⚠️  Error parsing workflow ${workflow.id}:`, error);
        continue;
      }

      // Ensure tagGroups structure exists
      if (!workflowData.tagGroups) {
        workflowData.tagGroups = {
          connected: [],
          notConnected: [],
        };
      }

      if (!workflowData.tagGroups.notConnected) {
        workflowData.tagGroups.notConnected = [];
      }

      // Check if NO ANSWER tag already exists
      const noAnswerIndex = workflowData.tagGroups.notConnected.findIndex(
        (tag: any) => tag.tagKey === "no_answer" || tag.id === "system_no_answer"
      );

      if (noAnswerIndex === -1) {
        // Add NO ANSWER tag to notConnected group
        workflowData.tagGroups.notConnected.push(NO_ANSWER_TAG);
        
        // Also add to individual tags
        if (!workflowData.tags) {
          workflowData.tags = {};
        }
        workflowData.tags[NO_ANSWER_TAG.id] = NO_ANSWER_TAG;

        console.log(`✅ Added NO ANSWER tag to workflow: ${workflow.name}`);
      } else {
        // Update existing tag with latest data (including icon fix)
        workflowData.tagGroups.notConnected[noAnswerIndex] = NO_ANSWER_TAG;
        
        // Also update in individual tags
        if (!workflowData.tags) {
          workflowData.tags = {};
        }
        workflowData.tags[NO_ANSWER_TAG.id] = NO_ANSWER_TAG;

        console.log(`🔄 Updated NO ANSWER tag in workflow: ${workflow.name}`);
      }

      // Update workflow (always update to ensure latest tag data)
      await prisma.workflow.update({
        where: { id: workflow.id },
        data: {
          workflowData: JSON.stringify(workflowData),
          version: workflow.version + 1,
        },
      });
    }

    console.log("✅ System tags seeding completed!");
  } catch (error) {
    console.error("❌ Error seeding system tags:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Run seed
seedSystemTags()
  .then(() => {
    console.log("🎉 Seed completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Seed failed:", error);
    process.exit(1);
  });
