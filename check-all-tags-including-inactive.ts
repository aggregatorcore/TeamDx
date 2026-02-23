import "dotenv/config";
import { prisma } from "./server/src/lib/prisma";

async function checkAllTags() {
  const leadId = "cmlevpc1r0011g0u37u6p27fc";
  
  const noAnswerTag = await prisma.tagFlow.findFirst({
    where: { tagValue: "no_answer", isActive: true },
  });

  if (!noAnswerTag) {
    console.log("No Answer tag not found");
    return;
  }

  // Check ALL tags (including inactive)
  const allTags = await prisma.tagApplication.findMany({
    where: {
      entityType: "lead",
      entityId: leadId,
      tagFlowId: noAnswerTag.id,
      // Remove isActive filter to see all tags
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  console.log(`\n📊 All Tag Applications (including inactive) for Lead ${leadId}:`);
  console.log(`   Total tags: ${allTags.length}`);
  console.log(`   Active tags: ${allTags.filter(t => t.isActive).length}`);
  console.log(`   Inactive tags: ${allTags.filter(t => !t.isActive).length}`);
  console.log("");

  allTags.forEach((tag, index) => {
    console.log(`${index + 1}. Tag ID: ${tag.id}`);
    console.log(`   Created: ${tag.createdAt.toISOString()}`);
    console.log(`   isActive: ${tag.isActive}`);
    console.log(`   callbackAt: ${tag.callbackAt ? tag.callbackAt.toISOString() : "NULL"}`);
  });

  // The issue: UI is counting ALL tags (including inactive) for attempt count
  // But it should only count ACTIVE tags, OR it should show different behavior at maxAttempts
  
  console.log("\n💡 Issue Analysis:");
  console.log(`   UI is showing: Attempt ${allTags.length}/3`);
  console.log(`   But according to logic:`);
  console.log(`   - If ${allTags.length} >= 3 (maxAttempts), then:`);
  console.log(`     * Tag should be disabled (no more retries)`);
  console.log(`     * Or show "Max attempts reached"`);
  console.log(`     * Or auto-escalate`);
  console.log(`   - Currently showing countdown even at 3/3, which is incorrect`);
}

checkAllTags()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
