import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";

async function checkLatestTagApplication() {
  try {
    // Get a lead with "No Answer" tag
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

    console.log(`\n📋 Lead: ${lead.firstName} ${lead.lastName} (${lead.id})\n`);

    // Get latest active "No Answer" tag application
    const latestTag = await prisma.tagApplication.findFirst({
      where: {
        entityType: "lead",
        entityId: lead.id,
        isActive: true,
        tagFlow: {
          tagValue: "no_answer",
        },
      },
      include: {
        tagFlow: {
          select: {
            id: true,
            tagValue: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!latestTag) {
      console.log("❌ No active 'No Answer' tag found for this lead");
      return;
    }

    console.log("📊 Latest Active TagApplication:");
    console.log(`   ID: ${latestTag.id}`);
    console.log(`   TagFlow: ${latestTag.tagFlow.name} (${latestTag.tagFlow.tagValue})`);
    console.log(`   CreatedAt: ${latestTag.createdAt.toISOString()}`);
    console.log(`   CallbackAt: ${latestTag.callbackAt ? latestTag.callbackAt.toISOString() : "❌ NULL"}`);
    console.log(`   IsActive: ${latestTag.isActive}`);

    // Check all "No Answer" tags for this lead
    const allTags = await prisma.tagApplication.findMany({
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
      select: {
        id: true,
        callbackAt: true,
        isActive: true,
        createdAt: true,
      },
    });

    console.log(`\n📊 All "No Answer" Tags (${allTags.length} total):`);
    allTags.forEach((tag, idx) => {
      console.log(`   ${idx + 1}. ID: ${tag.id.substring(0, 20)}...`);
      console.log(`      Created: ${tag.createdAt.toISOString()}`);
      console.log(`      CallbackAt: ${tag.callbackAt ? tag.callbackAt.toISOString() : "❌ NULL"}`);
      console.log(`      Active: ${tag.isActive}`);
      console.log();
    });

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkLatestTagApplication();
