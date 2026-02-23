import "dotenv/config";
import { prisma } from "./server/src/lib/prisma";

console.log("🔍 Monitoring for 'No Answer' tag applications...");
console.log("Press Ctrl+C to stop\n");

const noAnswerTagId = "cmky5foss002pdsu3pfi3azy2"; // From previous check

let lastCount = 0;

async function checkNewTags() {
  const count = await prisma.tagApplication.count({
    where: {
      tagFlowId: noAnswerTagId,
      isActive: true,
    },
  });

  if (count > lastCount) {
    console.log(`\n✅ New tag application detected! (Total: ${count})`);
    
    const latest = await prisma.tagApplication.findFirst({
      where: {
        tagFlowId: noAnswerTagId,
        isActive: true,
      },
      include: {
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
      console.log(`\n📋 Latest Tag Application:`);
      console.log(`   ID: ${latest.id}`);
      console.log(`   Lead ID: ${latest.entityId}`);
      console.log(`   Applied by: ${latest.appliedBy.firstName} ${latest.appliedBy.lastName}`);
      console.log(`   Applied at: ${latest.createdAt.toISOString()}`);
      console.log(`   callbackAt: ${latest.callbackAt ? latest.callbackAt.toISOString() : "❌ NULL"}`);
      
      if (latest.callbackAt) {
        const now = new Date();
        const diff = latest.callbackAt.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        console.log(`   ⏰ Next call in: ${hours}h ${minutes}m`);
        console.log(`\n✅ SUCCESS: callbackAt is set! Countdown should work.`);
      } else {
        console.log(`\n❌ ISSUE: callbackAt is NULL! TagConfig behaviors may not be executing.`);
        console.log(`   Check backend console logs for [TagConfig] messages.`);
      }
    }
    
    lastCount = count;
  }
}

// Check every 2 seconds
const interval = setInterval(checkNewTags, 2000);

// Initial check
checkNewTags();

// Cleanup on exit
process.on('SIGINT', () => {
  clearInterval(interval);
  prisma.$disconnect();
  console.log("\n👋 Monitoring stopped.");
  process.exit(0);
});
