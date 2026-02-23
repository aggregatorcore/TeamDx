import "dotenv/config";
import { prisma } from "./server/src/lib/prisma";

async function fixMissingCallback() {
  // Find tag application without callbackAt
  const tag = await prisma.tagApplication.findFirst({
    where: {
      id: "cmlf09zft000c1su39bphb7az", // From the check
    },
    include: {
      tagFlow: true,
    },
  });

  if (!tag) {
    console.log("Tag not found");
    return;
  }

  console.log(`Found tag: ${tag.id}`);
  console.log(`Current callbackAt: ${tag.callbackAt}`);

  // Calculate callback time (+60m from now, shift-aware)
  const { calculateShiftAwareCallback, getDefaultTelecallerShift } = require("./utils/shiftUtils");
  
  const shiftConfig = getDefaultTelecallerShift();
  const baseTime = new Date();
  const callbackTime = calculateShiftAwareCallback(
    baseTime,
    "+60m",
    shiftConfig.shiftStart,
    shiftConfig.shiftEnd
  );

  // Update tag application
  await prisma.tagApplication.update({
    where: { id: tag.id },
    data: { callbackAt: callbackTime },
  });

  // Update lead
  await prisma.lead.update({
    where: { id: tag.entityId },
    data: { callbackScheduledAt: callbackTime },
  });

  console.log(`✅ Updated callbackAt to: ${callbackTime.toISOString()}`);
  console.log(`   Next call in: ${Math.floor((callbackTime.getTime() - baseTime.getTime()) / (1000 * 60))} minutes`);
}

fixMissingCallback()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
