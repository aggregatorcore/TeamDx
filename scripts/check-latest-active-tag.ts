import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";

async function checkLatestActiveTag() {
  try {
    const leadId = process.argv[2];
    
    if (!leadId) {
      console.log("Usage: npx tsx scripts/check-latest-active-tag.ts <leadId>");
      console.log("\nOr provide leadId as argument:");
      process.exit(1);
    }

    console.log(`\n🔍 Checking latest ACTIVE tag for lead: ${leadId}\n`);

    // Get latest ACTIVE tag application
    const latestTag = await prisma.tagApplication.findFirst({
      where: {
        entityType: "lead",
        entityId: leadId,
        isActive: true,
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
        createdAt: "desc",
      },
    });

    if (!latestTag) {
      console.log("❌ No active tag found for this lead");
      return;
    }

    console.log("📊 Latest ACTIVE TagApplication:");
    console.log(`   ID: ${latestTag.id}`);
    console.log(`   TagFlow: ${latestTag.tagFlow.name} (${latestTag.tagFlow.tagValue})`);
    console.log(`   CreatedAt: ${latestTag.createdAt.toISOString()}`);
    console.log(`   CallbackAt: ${latestTag.callbackAt ? latestTag.callbackAt.toISOString() : "❌ NULL"}`);
    console.log(`   IsActive: ${latestTag.isActive}`);

    // Check if it's "No Answer" tag
    if (latestTag.tagFlow.tagValue === "no_answer") {
      if (!latestTag.callbackAt) {
        console.log("\n❌ ISSUE CONFIRMED: 'No Answer' tag has NULL callbackAt!");
        console.log("   This is why UI shows warning message.");
      } else {
        console.log("\n✅ 'No Answer' tag has callbackAt set!");
        console.log(`   Callback scheduled for: ${latestTag.callbackAt.toISOString()}`);
      }
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkLatestActiveTag();
