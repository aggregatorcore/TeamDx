import "dotenv/config";
import { prisma } from "./server/src/lib/prisma";

async function checkRecentTagApplications() {
  console.log("🔍 Checking recent 'No Answer' tag applications...\n");

  // Find the "No Answer" tag flow
  const noAnswerTag = await prisma.tagFlow.findFirst({
    where: {
      tagValue: "no_answer",
      isActive: true,
    },
  });

  if (!noAnswerTag) {
    console.log("❌ 'No Answer' tag not found in database");
    return;
  }

  console.log(`✅ Found 'No Answer' tag: ${noAnswerTag.name} (ID: ${noAnswerTag.id})\n`);

  // Get recent tag applications
  const recentTags = await prisma.tagApplication.findMany({
    where: {
      tagFlowId: noAnswerTag.id,
      isActive: true,
    },
    include: {
      tagFlow: {
        select: {
          name: true,
          tagValue: true,
        },
      },
      appliedBy: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  console.log(`📊 Found ${recentTags.length} recent 'No Answer' tag applications:\n`);

  if (recentTags.length === 0) {
    console.log("⚠️  No recent tag applications found. Apply 'No Answer' tag to a lead first.");
    return;
  }

  recentTags.forEach((tag, index) => {
    console.log(`\n${index + 1}. Tag Application ID: ${tag.id}`);
    console.log(`   Lead ID: ${tag.entityId}`);
    console.log(`   Applied by: ${tag.appliedBy.firstName} ${tag.appliedBy.lastName}`);
    console.log(`   Applied at: ${tag.createdAt.toISOString()}`);
    console.log(`   callbackAt: ${tag.callbackAt ? tag.callbackAt.toISOString() : "❌ NULL"}`);
    
    if (tag.callbackAt) {
      const now = new Date();
      const diff = tag.callbackAt.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (diff > 0) {
        console.log(`   ⏰ Next call in: ${hours}h ${minutes}m`);
      } else {
        const overdueHours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
        console.log(`   ⚠️  Overdue by: ${overdueHours}h`);
      }
    } else {
      console.log(`   ❌ ISSUE: callbackAt is NULL - TagConfig behaviors may not be working!`);
    }
  });

  // Check active workflow
  const activeWorkflow = await prisma.workflow.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  console.log(`\n\n📋 Workflow Status:`);
  if (activeWorkflow) {
    console.log(`   ✅ Active workflow found: ${activeWorkflow.name} (ID: ${activeWorkflow.id})`);
    
    // Check if workflow has tagConfig for no_answer
    const workflowData: any = typeof activeWorkflow.workflowData === "string"
      ? JSON.parse(activeWorkflow.workflowData)
      : activeWorkflow.workflowData;

    let hasTagConfig = false;
    if (workflowData.tags) {
      const tag = Object.values(workflowData.tags).find((t: any) => 
        t.tagValue === "no_answer" || t.name?.toLowerCase() === "no answer"
      );
      if (tag && tag.tagConfig) {
        hasTagConfig = true;
        console.log(`   ✅ TagConfig found for 'No Answer' tag`);
        console.log(`      autoAction: ${tag.tagConfig.autoAction || 'N/A'}`);
        console.log(`      hasRetryPolicy: ${!!tag.tagConfig.retryPolicy}`);
        console.log(`      hasAttemptTimings: ${!!tag.tagConfig.retryPolicy?.attemptTimings}`);
      }
    }

    if (!hasTagConfig && workflowData.tagGroups) {
      const allTags = [
        ...(workflowData.tagGroups.connected || []),
        ...(workflowData.tagGroups.notConnected || []),
      ];
      const tag = allTags.find((t: any) => 
        t.tagValue === "no_answer" || t.name?.toLowerCase() === "no answer"
      );
      if (tag && tag.tagConfig) {
        hasTagConfig = true;
        console.log(`   ✅ TagConfig found for 'No Answer' tag in tagGroups`);
        console.log(`      autoAction: ${tag.tagConfig.autoAction || 'N/A'}`);
        console.log(`      hasRetryPolicy: ${!!tag.tagConfig.retryPolicy}`);
        console.log(`      hasAttemptTimings: ${!!tag.tagConfig.retryPolicy?.attemptTimings}`);
      }
    }

    if (!hasTagConfig) {
      console.log(`   ❌ ISSUE: No TagConfig found for 'No Answer' tag in workflow!`);
    }
  } else {
    console.log(`   ❌ ISSUE: No active workflow found!`);
  }

  // Summary
  const tagsWithCallback = recentTags.filter(t => t.callbackAt !== null).length;
  const tagsWithoutCallback = recentTags.length - tagsWithCallback;

  console.log(`\n\n📊 Summary:`);
  console.log(`   Total recent tags: ${recentTags.length}`);
  console.log(`   ✅ With callbackAt: ${tagsWithCallback}`);
  console.log(`   ❌ Without callbackAt: ${tagsWithoutCallback}`);

  if (tagsWithoutCallback > 0) {
    console.log(`\n   ⚠️  ${tagsWithoutCallback} tag(s) missing callbackAt - TagConfig behaviors may not be executing!`);
  }
}

checkRecentTagApplications()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
