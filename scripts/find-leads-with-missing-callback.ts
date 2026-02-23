import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";

async function findLeadsWithMissingCallback() {
  console.log("\n" + "=".repeat(100));
  console.log("🔍 FINDING LEADS WITH MISSING CALLBACKS");
  console.log("=".repeat(100) + "\n");

  try {
    // Get all active "No Answer" tags with missing callbackAt
    const tagsWithMissingCallback = await prisma.tagApplication.findMany({
      where: {
        entityType: "lead",
        isActive: true,
        callbackAt: null,
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
        appliedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`📊 Found ${tagsWithMissingCallback.length} active tags with missing callbackAt\n`);

    if (tagsWithMissingCallback.length === 0) {
      console.log("✅ No tags with missing callbackAt found!\n");
      return;
    }

    // Group by lead
    const leadsMap = new Map<string, any[]>();
    tagsWithMissingCallback.forEach(tag => {
      if (!leadsMap.has(tag.entityId)) {
        leadsMap.set(tag.entityId, []);
      }
      leadsMap.get(tag.entityId)!.push(tag);
    });

    // Get lead details
    for (const [leadId, tags] of leadsMap.entries()) {
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
        console.log(`⚠️  Lead ${leadId} not found`);
        continue;
      }

      console.log(`\n${"=".repeat(100)}`);
      console.log(`📋 Lead: ${lead.firstName} ${lead.lastName} (${lead.phone})`);
      console.log(`   Lead ID: ${leadId}`);
      console.log(`   Email: ${lead.email}`);
      console.log(`   Lead.callbackScheduledAt: ${lead.callbackScheduledAt ? new Date(lead.callbackScheduledAt).toLocaleString() : "❌ NULL"}`);
      console.log(`   Tags with missing callbackAt: ${tags.length}`);

      tags.forEach((tag, index) => {
        console.log(`\n   📌 Tag ${index + 1}:`);
        console.log(`      Tag ID: ${tag.id}`);
        console.log(`      Created: ${new Date(tag.createdAt).toLocaleString()}`);
        console.log(`      Applied By: ${tag.appliedBy?.firstName} ${tag.appliedBy?.lastName} (${tag.appliedBy?.email})`);
        console.log(`      CallbackAt: ❌ NULL`);
      });

      // Get ALL tags for this lead to see attempt count
      const allTags = await prisma.tagApplication.findMany({
        where: {
          entityType: "lead",
          entityId: leadId,
          tagFlow: {
            tagValue: "no_answer",
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      console.log(`\n   📊 Total Tags (all): ${allTags.length}`);
      console.log(`   📊 Active Tags: ${allTags.filter(t => t.isActive).length}`);
      console.log(`   📊 Tags with callbackAt: ${allTags.filter(t => t.callbackAt !== null).length}`);
    }

    console.log("\n" + "=".repeat(100));
    console.log("✅ CHECK COMPLETE\n");

  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

findLeadsWithMissingCallback();
