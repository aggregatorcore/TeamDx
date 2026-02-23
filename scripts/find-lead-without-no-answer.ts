import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";

async function findLeadWithoutNoAnswer() {
  try {
    // Get all leads assigned to Kajal
    const leads = await prisma.lead.findMany({
      where: {
        assignedToId: "cml2dyf8l0001i8u31y664nsu", // Kajal
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
      take: 20,
    });

    console.log(`📊 Checking ${leads.length} leads...\n`);

    for (const lead of leads) {
      const noAnswerTags = await prisma.tagApplication.findMany({
        where: {
          entityType: "lead",
          entityId: lead.id,
          tagFlow: {
            tagValue: "no_answer",
          },
          isActive: true,
        },
      });

      if (noAnswerTags.length === 0) {
        console.log(`✅ Found lead WITHOUT "No Answer" tag:`);
        console.log(`   Name: ${lead.firstName} ${lead.lastName}`);
        console.log(`   Phone: ${lead.phone}`);
        console.log(`   URL: http://localhost:3000/leads/${lead.id}`);
        console.log(`   ID: ${lead.id}\n`);
        break;
      } else if (noAnswerTags.length < 3) {
        console.log(`⚠️ Found lead with ${noAnswerTags.length}/3 "No Answer" tags:`);
        console.log(`   Name: ${lead.firstName} ${lead.lastName}`);
        console.log(`   Phone: ${lead.phone}`);
        console.log(`   URL: http://localhost:3000/leads/${lead.id}`);
        console.log(`   ID: ${lead.id}\n`);
        break;
      }
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

findLeadWithoutNoAnswer();
