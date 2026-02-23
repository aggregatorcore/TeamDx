import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";

async function main() {
  console.log("🚀 Creating 40 test leads for Telecaller: Kajal Mehta (kajal@tvf.com)...");

  // Find telecaller user
  const kajal = await prisma.user.findUnique({
    where: { email: "kalaj@tvf.com" },
  });

  if (!kajal) {
    console.error("❌ Telecaller user 'kalaj@tvf.com' not found. Aborting.");
    return;
  }

  // Try to find admin as creator (optional)
  const admin = await prisma.user.findUnique({
    where: { email: "admin@immigration.com" },
  });

  const createdById = admin?.id ?? kajal.id;

  const basePhone = 9990000000; // Just a base; will add index to keep unique

  const leadsData = Array.from({ length: 40 }).map((_, index) => {
    const n = index + 1;
    const phone = String(basePhone + n);

    return {
      firstName: `Test${n}`,
      lastName: "Lead",
      email: `test${n}.lead@example.com`,
      phone,
      country: "India",
      visaType: "Student",
      source: "Test Seed",
      status: "new",
      priority: "medium",
      assignedToId: kajal.id,
      assignedById: createdById,
      assignedAt: new Date(),
      createdById,
      notes: "Auto-generated test lead for Telecaller workflow testing.",
    };
  });

  let createdCount = 0;

  for (const data of leadsData) {
    try {
      await prisma.lead.create({ data });
      createdCount++;
      console.log(`✅ Created lead for phone ${data.phone}`);
    } catch (error: any) {
      console.error(`⚠️ Failed to create lead for phone ${data.phone}:`, error?.message || error);
    }
  }

  console.log(`\n🎯 Done. Successfully created ${createdCount}/40 leads for ${kajal.firstName} ${kajal.lastName}.`);
}

main().catch((err) => {
  console.error("Unexpected error while creating test leads:", err);
});

