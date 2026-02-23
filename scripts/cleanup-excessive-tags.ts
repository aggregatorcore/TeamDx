import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";

async function cleanupExcessiveTags() {
  console.log("\n" + "=".repeat(100));
  console.log("🧹 CLEANUP EXCESSIVE NO ANSWER TAGS");
  console.log("=".repeat(100) + "\n");

  try {
    // Get active workflow to find maxAttempts
    const activeWorkflow = await prisma.workflow.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!activeWorkflow) {
      console.error("❌ No active workflow found.");
      return;
    }

    const workflowData: any = typeof activeWorkflow.workflowData === "string"
      ? JSON.parse(activeWorkflow.workflowData)
      : activeWorkflow.workflowData;

    let tagConfig: any = null;
    if (workflowData.tags) {
      const tag = Object.values(workflowData.tags).find((t: any) => 
        t.tagValue === "no_answer" || t.name?.toLowerCase() === "no answer"
      );
      if (tag && tag.tagConfig) {
        tagConfig = tag.tagConfig;
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
      if (tag && tag.tagConfig) {
        tagConfig = tag.tagConfig;
      }
    }

    const maxAttempts = tagConfig?.retryPolicy?.maxAttempts || 3;
    console.log(`📋 Max Attempts: ${maxAttempts}\n`);

    // Get all leads with "No Answer" tags
    const allNoAnswerTags = await prisma.tagApplication.findMany({
      where: {
        entityType: "lead",
        tagFlow: {
          tagValue: "no_answer",
        },
      },
      include: {
        tagFlow: {
          select: {
            id: true,
            name: true,
            tagValue: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Group by lead
    const leadsMap = new Map<string, any[]>();
    allNoAnswerTags.forEach(tag => {
      if (!leadsMap.has(tag.entityId)) {
        leadsMap.set(tag.entityId, []);
      }
      leadsMap.get(tag.entityId)!.push(tag);
    });

    console.log(`📊 Found ${leadsMap.size} leads with "No Answer" tags\n`);

    let totalDeactivated = 0;
    let leadsFixed = 0;

    // Process each lead
    for (const [leadId, tags] of leadsMap.entries()) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      });

      if (!lead) continue;

      const totalTags = tags.length;
      
      if (totalTags <= maxAttempts) {
        // No cleanup needed
        continue;
      }

      console.log(`\n📋 ${lead.firstName} ${lead.lastName} (${lead.phone})`);
      console.log(`   Total Tags: ${totalTags} (Max: ${maxAttempts})`);

      // Keep only the latest maxAttempts tags active
      // Sort by createdAt DESC to get latest first
      const sortedTags = [...tags].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const tagsToKeep = sortedTags.slice(0, maxAttempts);
      const tagsToDeactivate = sortedTags.slice(maxAttempts);

      console.log(`   Keeping: ${tagsToKeep.length} latest tags`);
      console.log(`   Deactivating: ${tagsToDeactivate.length} older tags`);

      // Deactivate older tags
      for (const tag of tagsToDeactivate) {
        await prisma.tagApplication.update({
          where: { id: tag.id },
          data: { isActive: false },
        });
        totalDeactivated++;
      }

      // Update lead's callbackScheduledAt to the earliest upcoming callback from active tags
      const activeTagsWithCallback = tagsToKeep.filter(t => t.isActive && t.callbackAt !== null);
      if (activeTagsWithCallback.length > 0) {
        const earliestCallback = activeTagsWithCallback
          .map(t => new Date(t.callbackAt!))
          .sort((a, b) => a.getTime() - b.getTime())[0];

        await prisma.lead.update({
          where: { id: leadId },
          data: { callbackScheduledAt: earliestCallback },
        });

        console.log(`   ✅ Updated Lead.callbackScheduledAt: ${earliestCallback.toLocaleString()}`);
      }

      leadsFixed++;
    }

    console.log("\n" + "=".repeat(100));
    console.log("📊 CLEANUP SUMMARY");
    console.log("=".repeat(100));
    console.log(`\n✅ Leads Fixed: ${leadsFixed}`);
    console.log(`🗑️  Tags Deactivated: ${totalDeactivated}`);
    console.log("\n✅ CLEANUP COMPLETE\n");

  } catch (error: any) {
    console.error("\n❌ CRITICAL ERROR:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupExcessiveTags();
