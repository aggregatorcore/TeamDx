import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";

async function checkNoAnswerTagConfig() {
  try {
    // Get "No Answer" tagFlow
    const noAnswerTag = await prisma.tagFlow.findFirst({
      where: {
        tagValue: "no_answer",
      },
      select: {
        id: true,
        name: true,
        tagValue: true,
        actions: true,
        escalations: true,
      },
    });

    if (!noAnswerTag) {
      console.log("❌ 'No Answer' tagFlow not found");
      return;
    }

    console.log("📊 TagFlow Details:");
    console.log(`   ID: ${noAnswerTag.id}`);
    console.log(`   Name: ${noAnswerTag.name}`);
    console.log(`   TagValue: ${noAnswerTag.tagValue}`);
    console.log(`   Actions: ${noAnswerTag.actions || "NULL"}`);
    console.log(`   Escalations: ${noAnswerTag.escalations || "NULL"}`);

    // Get active workflow
    const activeWorkflow = await prisma.workflow.findFirst({
      where: {
        isActive: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (!activeWorkflow) {
      console.log("\n❌ No active workflow found");
      return;
    }

    console.log(`\n📊 Active Workflow: ${activeWorkflow.name}`);
    
    const workflowData: any = typeof activeWorkflow.workflowData === "string"
      ? JSON.parse(activeWorkflow.workflowData)
      : activeWorkflow.workflowData;

    // Find "No Answer" tag config
    let tagConfig: any = null;

    if (workflowData.tags) {
      const tag = Object.values(workflowData.tags).find((t: any) => 
        t.tagValue === "no_answer" || t.name?.toLowerCase() === "no answer"
      );
      if (tag) {
        tagConfig = tag.tagConfig || tag;
        console.log("\n✅ Found in workflowData.tags");
      }
    }

    if (!tagConfig && workflowData.tagGroups) {
      const allTags = [
        ...(workflowData.tagGroups.connected || []),
        ...(workflowData.tagGroups.notConnected || []),
      ];
      const tag = allTags.find((t: any) => 
        t.tagValue === "no_answer" || t.name?.toLowerCase() === "no answer"
      );
      if (tag) {
        tagConfig = tag.tagConfig || tag;
        console.log("\n✅ Found in workflowData.tagGroups");
      }
    }

    if (!tagConfig) {
      console.log("\n❌ 'No Answer' tag config not found in workflow");
      return;
    }

    console.log("\n📋 Tag Config:");
    console.log(JSON.stringify(tagConfig, null, 2));

    // Check retryPolicy
    if (tagConfig.retryPolicy) {
      console.log("\n📋 Retry Policy:");
      console.log(`   MaxAttempts: ${tagConfig.retryPolicy.maxAttempts || "NOT SET"}`);
      console.log(`   AttemptTimings:`, JSON.stringify(tagConfig.retryPolicy.attemptTimings, null, 2));
    }

    // Check autoAction
    if (tagConfig.autoAction) {
      console.log(`\n✅ AutoAction: ${tagConfig.autoAction}`);
    } else {
      console.log(`\n⚠️ AutoAction: NOT SET (might be the issue!)`);
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkNoAnswerTagConfig();
