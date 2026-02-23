import { prisma } from "../server/src/lib/prisma";

async function checkCallbackAt() {
  try {
    // Get all active "No Answer" tag applications
    const noAnswerTags = await prisma.tagApplication.findMany({
      where: {
        entityType: "lead",
        isActive: true,
        tagFlow: {
          tagValue: "no_answer",
        },
      },
      select: {
        id: true,
        entityId: true,
        callbackAt: true,
        createdAt: true,
        tagFlow: {
          select: {
            name: true,
            tagValue: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10, // Check last 10
    });

    console.log("\n📊 No Answer Tag Applications (Last 10):");
    console.log("=" .repeat(80));
    
    if (noAnswerTags.length === 0) {
      console.log("❌ No active 'No Answer' tag applications found.");
      return;
    }

    let withCallback = 0;
    let withoutCallback = 0;

    noAnswerTags.forEach((tag, index) => {
      const hasCallback = tag.callbackAt !== null;
      if (hasCallback) withCallback++;
      else withoutCallback++;

      console.log(`\n${index + 1}. Tag ID: ${tag.id}`);
      console.log(`   Lead ID: ${tag.entityId}`);
      console.log(`   Tag: ${tag.tagFlow.name} (${tag.tagFlow.tagValue})`);
      console.log(`   Created: ${new Date(tag.createdAt).toLocaleString()}`);
      console.log(`   CallbackAt: ${tag.callbackAt ? new Date(tag.callbackAt).toLocaleString() : "❌ NULL"}`);
      console.log(`   Status: ${hasCallback ? "✅ Has callbackAt" : "❌ Missing callbackAt"}`);
    });

    console.log("\n" + "=".repeat(80));
    console.log(`\n📈 Summary:`);
    console.log(`   ✅ With callbackAt: ${withCallback}`);
    console.log(`   ❌ Without callbackAt: ${withoutCallback}`);
    console.log(`   Total: ${noAnswerTags.length}`);

    if (withoutCallback > 0) {
      console.log(`\n⚠️  ${withoutCallback} tag(s) are missing callbackAt!`);
      console.log(`   These tags need to be re-applied or callbackAt needs to be set manually.`);
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCallbackAt();
