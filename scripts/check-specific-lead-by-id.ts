import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";

async function checkLead() {
  try {
    // The lead ID from the console logs
    const leadId = "cmlevpbzr000pg0u3fpep6yd3";
    
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        callbackScheduledAt: true,
      },
    });

    if (!lead) {
      console.log("❌ Lead not found");
      return;
    }

    console.log(`\n📊 Lead: ${lead.firstName} ${lead.lastName} (${lead.phone})`);
    console.log(`   Lead ID: ${leadId}`);
    console.log(`   Email: ${lead.email}`);
    console.log(`   Lead.callbackScheduledAt: ${lead.callbackScheduledAt ? new Date(lead.callbackScheduledAt).toLocaleString() : "❌ NULL"}`);

    // Get ALL tag applications (active + inactive)
    const allTagApplications = await prisma.tagApplication.findMany({
      where: {
        entityType: "lead",
        entityId: lead.id,
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
    });

    console.log(`\n📋 All Tag Applications (No Answer): ${allTagApplications.length} total`);

    allTagApplications.forEach((tag, index) => {
      console.log(`\n${index + 1}. Tag Application ID: ${tag.id}`);
      console.log(`   Created: ${new Date(tag.createdAt).toLocaleString()}`);
      console.log(`   CallbackAt: ${tag.callbackAt ? new Date(tag.callbackAt).toLocaleString() : "❌ NULL"}`);
      console.log(`   IsActive: ${tag.isActive ? "✅" : "❌"}`);
    });

    const latestTag = allTagApplications[0];
    if (latestTag && !latestTag.callbackAt) {
      console.log(`\n⚠️  Latest tag is missing callbackAt!`);
      console.log(`   This should have been set automatically when the tag was applied.`);
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkLead();
