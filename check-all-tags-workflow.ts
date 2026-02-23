import "dotenv/config";
import { prisma } from "./server/src/lib/prisma";

async function checkAll() {
  console.log("🔍 Complete Tag & Workflow Check\n");
  console.log("=" * 70);

  // 1. Check No Answer tag
  const noAnswerTag = await prisma.tagFlow.findFirst({
    where: { tagValue: "no_answer", isActive: true },
  });

  if (!noAnswerTag) {
    console.log("\n❌ 'No Answer' tag not found!");
    return;
  }

  console.log(`\n✅ 'No Answer' tag found: ${noAnswerTag.name} (ID: ${noAnswerTag.id})`);

  // 2. Check ALL tag applications (not just recent)
  const allTags = await prisma.tagApplication.findMany({
    where: {
      tagFlowId: noAnswerTag.id,
      isActive: true,
    },
    include: {
      appliedBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  console.log(`\n📊 Total 'No Answer' tag applications: ${allTags.length}`);

  if (allTags.length > 0) {
    console.log("\n📋 Tag Applications:");
    allTags.forEach((tag, index) => {
      const hasCallback = tag.callbackAt !== null;
      const status = hasCallback ? "✅" : "❌";
      console.log(`\n${index + 1}. ${status} ID: ${tag.id}`);
      console.log(`   Lead: ${tag.entityId}`);
      console.log(`   Applied: ${tag.createdAt.toLocaleString()}`);
      console.log(`   callbackAt: ${tag.callbackAt ? tag.callbackAt.toISOString() : "NULL"}`);
      if (!hasCallback) {
        console.log(`   ⚠️  ISSUE: callbackAt is NULL!`);
      }
    });

    const withCallback = allTags.filter(t => t.callbackAt !== null).length;
    const withoutCallback = allTags.length - withCallback;
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ With callbackAt: ${withCallback}`);
    console.log(`   ❌ Without callbackAt: ${withoutCallback}`);
  }

  // 3. Check Active Workflow
  console.log("\n\n" + "=" * 70);
  console.log("📋 Workflow Configuration Check:");
  
  const activeWorkflow = await prisma.workflow.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!activeWorkflow) {
    console.log("\n❌ No active workflow found!");
    console.log("   This is why callbackAt is not being set!");
    return;
  }

  console.log(`\n✅ Active workflow: ${activeWorkflow.name} (ID: ${activeWorkflow.id})`);

  const workflowData: any = typeof activeWorkflow.workflowData === "string"
    ? JSON.parse(activeWorkflow.workflowData)
    : activeWorkflow.workflowData;

  // Check in tags object
  let tagConfig = null;
  if (workflowData.tags) {
    const tag = Object.values(workflowData.tags).find((t: any) => 
      t.tagValue === "no_answer" || 
      t.name?.toLowerCase() === "no answer" ||
      t.id === noAnswerTag.id
    );
    if (tag && tag.tagConfig) {
      tagConfig = tag.tagConfig;
      console.log(`\n✅ TagConfig found in workflowData.tags`);
    }
  }

  // Check in tagGroups if not found
  if (!tagConfig && workflowData.tagGroups) {
    const allTags = [
      ...(workflowData.tagGroups.connected || []),
      ...(workflowData.tagGroups.notConnected || []),
    ];
    const tag = allTags.find((t: any) => 
      t.tagValue === "no_answer" || 
      t.name?.toLowerCase() === "no answer" ||
      t.id === noAnswerTag.id
    );
    if (tag && tag.tagConfig) {
      tagConfig = tag.tagConfig;
      console.log(`\n✅ TagConfig found in workflowData.tagGroups`);
    }
  }

  if (!tagConfig) {
    console.log(`\n❌ ISSUE: No TagConfig found for 'No Answer' tag in workflow!`);
    console.log(`   This is why callbackAt is not being set automatically.`);
    console.log(`\n   Workflow structure:`);
    console.log(`   - hasTags: ${!!workflowData.tags}`);
    console.log(`   - hasTagGroups: ${!!workflowData.tagGroups}`);
    if (workflowData.tags) {
      console.log(`   - tags keys: ${Object.keys(workflowData.tags).join(", ")}`);
    }
    if (workflowData.tagGroups) {
      console.log(`   - connected tags: ${workflowData.tagGroups.connected?.length || 0}`);
      console.log(`   - notConnected tags: ${workflowData.tagGroups.notConnected?.length || 0}`);
    }
    return;
  }

  console.log(`\n✅ TagConfig found!`);
  console.log(`   autoAction: ${tagConfig.autoAction || "N/A"}`);
  console.log(`   hasRetryPolicy: ${!!tagConfig.retryPolicy}`);
  
  if (tagConfig.retryPolicy) {
    console.log(`   maxAttempts: ${tagConfig.retryPolicy.maxAttempts || "N/A"}`);
    console.log(`   hasAttemptTimings: ${!!tagConfig.retryPolicy.attemptTimings}`);
    
    if (tagConfig.retryPolicy.attemptTimings) {
      const timings = Array.isArray(tagConfig.retryPolicy.attemptTimings) 
        ? tagConfig.retryPolicy.attemptTimings 
        : Object.values(tagConfig.retryPolicy.attemptTimings);
      console.log(`   attemptTimings count: ${timings.length}`);
      if (timings.length > 0) {
        console.log(`   first attempt timing: ${timings[0]?.timing || "N/A"}`);
      }
    } else {
      console.log(`   ⚠️  No attemptTimings found!`);
    }
  }

  console.log("\n" + "=" * 70);
  console.log("\n💡 Diagnosis:");
  
  if (allTags.length === 0) {
    console.log("   - No 'No Answer' tags have been applied yet");
    console.log("   - Apply the tag to a lead to test");
  } else {
    const withoutCallback = allTags.filter(t => t.callbackAt === null).length;
    if (withoutCallback > 0) {
      console.log(`   - ${withoutCallback} tag(s) missing callbackAt`);
      if (tagConfig && tagConfig.autoAction === "CALLBACK") {
        console.log("   - TagConfig exists but callbackAt is not being set");
        console.log("   - Check backend logs when applying tag");
      }
    } else {
      console.log("   - All tags have callbackAt ✅");
    }
  }
}

checkAll()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
