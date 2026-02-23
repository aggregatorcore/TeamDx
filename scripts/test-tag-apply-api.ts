import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";

async function testTagApply() {
  try {
    // Get a lead
    const lead = await prisma.lead.findFirst({
      where: {
        assignedToId: "cml2dyf8l0001i8u31y664nsu", // Kajal
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!lead) {
      console.log("❌ No lead found");
      return;
    }

    console.log(`✅ Found lead: ${lead.firstName} ${lead.lastName} (${lead.id})`);

    // Get "No Answer" tag flow
    const noAnswerTag = await prisma.tagFlow.findFirst({
      where: {
        tagValue: "no_answer",
      },
      select: {
        id: true,
        name: true,
        tagValue: true,
      },
    });

    if (!noAnswerTag) {
      console.log("❌ No Answer tag not found");
      return;
    }

    console.log(`✅ Found tag: ${noAnswerTag.name} (${noAnswerTag.tagValue})`);

    // Check existing tags for this lead
    const existingTags = await prisma.tagApplication.findMany({
      where: {
        entityType: "lead",
        entityId: lead.id,
        tagFlow: {
          tagValue: "no_answer",
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    console.log(`\n📊 Existing "No Answer" tags: ${existingTags.length}`);
    existingTags.forEach((tag, idx) => {
      console.log(`  ${idx + 1}. Created: ${tag.createdAt.toISOString()}, Active: ${tag.isActive}, CallbackAt: ${tag.callbackAt?.toISOString() || "NULL"}`);
    });

    // Check if we should apply a new tag
    const activeTags = existingTags.filter(t => t.isActive);
    console.log(`\n📊 Active tags: ${activeTags.length}`);

    if (activeTags.length >= 3) {
      console.log("⚠️ Max attempts reached (3/3). Cannot apply more tags.");
      return;
    }

    // Apply tag via API simulation (we'll check backend logs)
    console.log(`\n🚀 Ready to apply tag via API:`);
    console.log(`   POST /api/tag-applications/lead/${lead.id}`);
    console.log(`   Body: { tagFlowId: "${noAnswerTag.id}" }`);
    console.log(`\n💡 Please apply tag manually in UI and check backend logs for:`);
    console.log(`   [TAG APPLICATION] ✅ callbackAt set successfully`);
    console.log(`   [FIX MISSING CALLBACKS JOB] ✅ Job completed`);

    // Check after a moment
    setTimeout(async () => {
      const updatedTags = await prisma.tagApplication.findMany({
        where: {
          entityType: "lead",
          entityId: lead.id,
          tagFlow: {
            tagValue: "no_answer",
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      });

      if (updatedTags.length > 0) {
        const latest = updatedTags[0];
        console.log(`\n📋 Latest tag status:`);
        console.log(`   CallbackAt: ${latest.callbackAt?.toISOString() || "❌ NULL"}`);
        console.log(`   Active: ${latest.isActive}`);
      }
    }, 5000);

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  } finally {
    // Don't disconnect immediately - wait for async check
    setTimeout(async () => {
      await prisma.$disconnect();
    }, 6000);
  }
}

testTagApply();
