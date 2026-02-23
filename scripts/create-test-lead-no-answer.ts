import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";

async function createTestLeadAndApplyNoAnswer() {
  try {
    // Find Kajal (Telecaller)
    const kajal = await prisma.user.findFirst({
      where: {
        email: "kajal@tvf.com",
      },
    });

    if (!kajal) {
      console.log("❌ Kajal user not found");
      return;
    }

    console.log(`\n📋 Creating test lead for: ${kajal.firstName} ${kajal.lastName}\n`);

    // Create a new test lead
    const lead = await prisma.lead.create({
      data: {
        firstName: "TestNoAnswer",
        lastName: "Lead",
        email: `testnoanswer.${Date.now()}@example.com`,
        phone: `999${Date.now().toString().slice(-7)}`,
        status: "new",
        assignedToId: kajal.id,
        assignedById: kajal.id,
        assignedAt: new Date(),
      },
    });

    console.log(`✅ Created lead: ${lead.firstName} ${lead.lastName} (${lead.id})`);

    // Find "No Answer" tagFlow
    const noAnswerTag = await prisma.tagFlow.findFirst({
      where: {
        tagValue: "no_answer",
      },
    });

    if (!noAnswerTag) {
      console.log("❌ 'No Answer' tagFlow not found");
      return;
    }

    console.log(`✅ Found 'No Answer' tag: ${noAnswerTag.name} (${noAnswerTag.id})`);

    // Apply "No Answer" tag
    const tagApplication = await prisma.tagApplication.create({
      data: {
        entityType: "lead",
        entityId: lead.id,
        tagFlowId: noAnswerTag.id,
        appliedById: kajal.id,
        isActive: true,
        // Note: callbackAt will be set by executeTagConfigBehaviors
        // But since we're creating it directly, it will be NULL initially
        // The cron job or immediate fallback should fix it
      },
    });

    console.log(`✅ Applied 'No Answer' tag: ${tagApplication.id}`);
    console.log(`   CallbackAt: ${tagApplication.callbackAt ? tagApplication.callbackAt.toISOString() : "NULL (will be fixed by cron/fallback)"}`);

    // Wait a moment for any async processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if callbackAt was set
    const updatedTag = await prisma.tagApplication.findUnique({
      where: { id: tagApplication.id },
      select: {
        id: true,
        callbackAt: true,
      },
    });

    if (updatedTag?.callbackAt) {
      console.log(`\n✅ CallbackAt was automatically set: ${updatedTag.callbackAt.toISOString()}`);
    } else {
      console.log(`\n⚠️ CallbackAt is still NULL - cron job will fix it within 5 minutes`);
      console.log(`   Or you can manually trigger fixMissingCallbacks()`);
    }

    console.log(`\n📋 Lead URL: http://localhost:3000/dashboard/leads/${lead.id}`);

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

createTestLeadAndApplyNoAnswer();
