import "dotenv/config";
import { prisma } from "./server/src/lib/prisma";

async function checkAttemptLogic() {
  const leadId = "cmlevpc1r0011g0u37u6p27fc"; // From user's message
  
  // Get all "No Answer" tag applications for this lead
  const noAnswerTag = await prisma.tagFlow.findFirst({
    where: { tagValue: "no_answer", isActive: true },
  });

  if (!noAnswerTag) {
    console.log("No Answer tag not found");
    return;
  }

  const tagApplications = await prisma.tagApplication.findMany({
    where: {
      entityType: "lead",
      entityId: leadId,
      tagFlowId: noAnswerTag.id,
      isActive: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  console.log(`\n📊 Tag Applications for Lead ${leadId}:`);
  console.log(`   Total active tags: ${tagApplications.length}`);
  console.log(`   Max attempts (from workflow): 3`);
  console.log("");

  tagApplications.forEach((tag, index) => {
    console.log(`${index + 1}. Tag ID: ${tag.id}`);
    console.log(`   Created: ${tag.createdAt.toISOString()}`);
    console.log(`   callbackAt: ${tag.callbackAt ? tag.callbackAt.toISOString() : "NULL"}`);
    console.log(`   isActive: ${tag.isActive}`);
  });

  // Check workflow configuration
  const activeWorkflow = await prisma.workflow.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  if (activeWorkflow) {
    const workflowData: any = typeof activeWorkflow.workflowData === "string"
      ? JSON.parse(activeWorkflow.workflowData)
      : activeWorkflow.workflowData;

    let tagConfig = null;
    if (workflowData.tags) {
      const tag = Object.values(workflowData.tags).find((t: any) => 
        t.tagValue === "no_answer" || t.id === noAnswerTag.id
      );
      if (tag && tag.tagConfig) {
        tagConfig = tag.tagConfig;
      }
    }

    if (tagConfig) {
      console.log("\n📋 Workflow Configuration:");
      console.log(`   maxAttempts: ${tagConfig.retryPolicy?.maxAttempts || "N/A"}`);
      console.log(`   Current attempts: ${tagApplications.length}`);
      
      if (tagApplications.length >= (tagConfig.retryPolicy?.maxAttempts || 3)) {
        console.log("\n⚠️  ISSUE: Max attempts reached!");
        console.log("   According to logic:");
        console.log("   - After 3 attempts, tag should either:");
        console.log("     1. Be disabled (no more retries)");
        console.log("     2. Show 'Max attempts reached' message");
        console.log("     3. Auto-escalate");
        console.log("     4. Or show different UI");
        console.log("\n   But currently:");
        console.log(`   - Tag is still active: ${tagApplications[tagApplications.length - 1]?.isActive}`);
        console.log(`   - Countdown is still showing`);
        console.log(`   - This is incorrect behavior!`);
      }
    }
  }
}

checkAttemptLogic()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
