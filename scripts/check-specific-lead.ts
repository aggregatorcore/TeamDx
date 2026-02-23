import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";

async function checkLead() {
  try {
    // Find lead by phone number or email
    const phone = "9990000031";
    
    const lead = await prisma.lead.findFirst({
      where: {
        OR: [
          { phone: phone },
          { email: { contains: "test31" } },
        ],
      },
    });

    if (!lead) {
      console.log("❌ Lead not found");
      return;
    }

    console.log(`\n📊 Lead: ${lead.firstName} ${lead.lastName} (${lead.phone})`);
    console.log(`   Lead ID: ${lead.id}`);
    console.log(`   Email: ${lead.email}`);

    // Get ALL tag applications (active + inactive) to see attempt count
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

    // Get only active tags
    const tagApplications = allTagApplications.filter(ta => ta.isActive);

    console.log(`\n📋 All Tag Applications (No Answer): ${allTagApplications.length} total`);
    console.log(`   Active: ${tagApplications.length}`);
    console.log(`   Inactive: ${allTagApplications.length - tagApplications.length}`);

    allTagApplications.forEach((tag, index) => {
      console.log(`\n${index + 1}. Tag Application ID: ${tag.id}`);
      console.log(`   Created: ${new Date(tag.createdAt).toLocaleString()}`);
      console.log(`   CallbackAt: ${tag.callbackAt ? new Date(tag.callbackAt).toLocaleString() : "❌ NULL"}`);
      console.log(`   IsActive: ${tag.isActive ? "✅" : "❌"}`);
    });

    const latestTag = tagApplications[0];
    
    // Check if there are inactive tags that might be counted
    const inactiveTags = allTagApplications.filter(ta => !ta.isActive);
    if (inactiveTags.length > 0) {
      console.log(`\n⚠️  Found ${inactiveTags.length} inactive tag(s) that might be counted in attempt count`);
    }
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
