import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";

async function checkCurrentWarningLead() {
  try {
    // Get all leads with active "No Answer" tags
    const leadsWithNoAnswer = await prisma.tagApplication.findMany({
      where: {
        entityType: "lead",
        isActive: true,
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
        createdAt: "desc",
      },
      take: 10, // Check last 10
    });

    console.log(`\n📊 Checking ${leadsWithNoAnswer.length} active "No Answer" tags:\n`);

    for (const tagApp of leadsWithNoAnswer) {
      const lead = await prisma.lead.findUnique({
        where: { id: tagApp.entityId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      console.log(`📋 Lead: ${lead?.firstName} ${lead?.lastName} (${lead?.id})`);
      console.log(`   Tag ID: ${tagApp.id}`);
      console.log(`   CreatedAt: ${tagApp.createdAt.toISOString()}`);
      console.log(`   CallbackAt: ${tagApp.callbackAt ? tagApp.callbackAt.toISOString() : "❌ NULL"}`);
      console.log(`   IsActive: ${tagApp.isActive}`);
      
      if (!tagApp.callbackAt) {
        console.log(`   ⚠️ THIS LEAD WILL SHOW WARNING IN UI!`);
      }
      console.log();
    }

    // Count NULL vs SET
    const nullCount = leadsWithNoAnswer.filter(ta => !ta.callbackAt).length;
    const setCount = leadsWithNoAnswer.filter(ta => ta.callbackAt).length;

    console.log(`\n📊 Summary:`);
    console.log(`   Total checked: ${leadsWithNoAnswer.length}`);
    console.log(`   With callbackAt: ${setCount} ✅`);
    console.log(`   Without callbackAt: ${nullCount} ❌`);

    if (nullCount > 0) {
      console.log(`\n❌ ${nullCount} tag(s) still have NULL callbackAt!`);
      console.log(`   These will show warning in UI.`);
      console.log(`   Run: npx tsx scripts/auto-fix-missing-callbacks.ts`);
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkCurrentWarningLead();
