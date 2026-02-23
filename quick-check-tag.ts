import "dotenv/config";
import { prisma } from "./server/src/lib/prisma";

async function quickCheck() {
  const latest = await prisma.tagApplication.findFirst({
    where: {
      tagFlow: {
        tagValue: "no_answer",
      },
      isActive: true,
    },
    include: {
      tagFlow: {
        select: {
          name: true,
          tagValue: true,
        },
      },
      appliedBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (latest) {
    console.log("✅ Latest 'No Answer' tag found:");
    console.log(`   ID: ${latest.id}`);
    console.log(`   Lead: ${latest.entityId}`);
    console.log(`   Applied: ${latest.createdAt.toISOString()}`);
    console.log(`   callbackAt: ${latest.callbackAt ? latest.callbackAt.toISOString() : "❌ NULL"}`);
    
    if (latest.callbackAt) {
      const now = new Date();
      const diff = latest.callbackAt.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      console.log(`   ⏰ Next call: ${hours}h ${minutes}m`);
      console.log("\n✅ SUCCESS: callbackAt is set! Countdown should work.");
    } else {
      console.log("\n❌ ISSUE: callbackAt is NULL!");
      console.log("   TagConfig behaviors may not be executing.");
    }
  } else {
    console.log("⚠️  No 'No Answer' tags found yet.");
    console.log("   Apply the tag to a lead first.");
  }
}

quickCheck()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
