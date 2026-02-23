import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";

async function checkTwoLeads() {
  try {
    // Find Test23 and Test14 leads
    const test23 = await prisma.lead.findFirst({
      where: {
        OR: [
          { firstName: { contains: "Test23", mode: "insensitive" } },
          { email: { contains: "test23", mode: "insensitive" } },
        ],
      },
    });

    const test14 = await prisma.lead.findFirst({
      where: {
        OR: [
          { firstName: { contains: "Test14", mode: "insensitive" } },
          { email: { contains: "test14", mode: "insensitive" } },
        ],
      },
    });

    // Fetch tagApplications separately
    let test23Tags: any[] = [];
    let test14Tags: any[] = [];

    if (test23) {
      test23Tags = await prisma.tagApplication.findMany({
        where: {
          entityType: "lead",
          entityId: test23.id,
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
      });
    }

    if (test14) {
      test14Tags = await prisma.tagApplication.findMany({
        where: {
          entityType: "lead",
          entityId: test14.id,
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
      });
    }

    console.log("\n📊 Test23 Lead:");
    if (test23) {
      console.log(`   ID: ${test23.id}`);
      console.log(`   Name: ${test23.firstName} ${test23.lastName}`);
      console.log(`   Email: ${test23.email}`);
      console.log(`   Active "No Answer" Tags: ${test23Tags.length}`);
      test23Tags.forEach((tag, idx) => {
        console.log(`   Tag ${idx + 1}:`);
        console.log(`      ID: ${tag.id}`);
        console.log(`      CreatedAt: ${tag.createdAt.toISOString()}`);
        console.log(`      CallbackAt: ${tag.callbackAt ? tag.callbackAt.toISOString() : "❌ NULL"}`);
        console.log(`      IsActive: ${tag.isActive}`);
      });
    } else {
      console.log("   ❌ Not found");
    }

    console.log("\n📊 Test14 Lead:");
    if (test14) {
      console.log(`   ID: ${test14.id}`);
      console.log(`   Name: ${test14.firstName} ${test14.lastName}`);
      console.log(`   Email: ${test14.email}`);
      console.log(`   Active "No Answer" Tags: ${test14Tags.length}`);
      test14Tags.forEach((tag, idx) => {
        console.log(`   Tag ${idx + 1}:`);
        console.log(`      ID: ${tag.id}`);
        console.log(`      CreatedAt: ${tag.createdAt.toISOString()}`);
        console.log(`      CallbackAt: ${tag.callbackAt ? tag.callbackAt.toISOString() : "❌ NULL"}`);
        console.log(`      IsActive: ${tag.isActive}`);
      });
    } else {
      console.log("   ❌ Not found");
    }

    // Compare
    if (test23 && test14 && test23Tags.length > 0 && test14Tags.length > 0) {
      console.log("\n🔍 Comparison:");
      const test23Tag = test23Tags[0];
      const test14Tag = test14Tags[0];
      
      console.log(`   Test23 callbackAt: ${test23Tag.callbackAt ? "✅ SET" : "❌ NULL"}`);
      console.log(`   Test14 callbackAt: ${test14Tag.callbackAt ? "✅ SET" : "❌ NULL"}`);
      console.log(`   Test23 createdAt: ${test23Tag.createdAt.toISOString()}`);
      console.log(`   Test14 createdAt: ${test14Tag.createdAt.toISOString()}`);
      const timeDiff = Math.abs(test23Tag.createdAt.getTime() - test14Tag.createdAt.getTime()) / 1000 / 60;
      console.log(`   Time difference: ${timeDiff.toFixed(2)} minutes`);
      
      if (!test14Tag.callbackAt && test23Tag.callbackAt) {
        console.log("\n❌ ISSUE: Test14 tag has NULL callbackAt but Test23 has it set!");
        console.log("   This means executeTagConfigBehaviors() did NOT run for Test14.");
        console.log("   Possible causes:");
        console.log("   1. Backend server was not running when Test14 tag was applied");
        console.log("   2. executeTagConfigBehaviors() threw an error for Test14");
        console.log("   3. TagConfig not found for Test14 tag");
      }
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkTwoLeads();
