import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const isSupabase = connectionString.includes("supabase");
const pool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding shift configurations...");

  // Find TELECALLER role
  const telecallerRole = await prisma.role.findUnique({
    where: { name: "TELECALLER" },
  });

  if (!telecallerRole) {
    console.error("❌ TELECALLER role not found. Please seed roles first.");
    process.exit(1);
  }

  console.log(`✅ Found TELECALLER role: ${telecallerRole.id}`);

  // Check if shift config already exists
  const existingConfig = await prisma.shiftConfig.findFirst({
    where: {
      roleId: telecallerRole.id,
      userId: null,
    },
  });

  if (existingConfig) {
    // Update existing config
    const updated = await prisma.shiftConfig.update({
      where: { id: existingConfig.id },
      data: {
        shiftStart: "09:30",
        shiftEnd: "17:30",
        isActive: true,
      },
    });
    console.log(`✅ Updated existing shift config for TELECALLER:`, {
      id: updated.id,
      shiftStart: updated.shiftStart,
      shiftEnd: updated.shiftEnd,
    });
  } else {
    // Create new shift config
    const shiftConfig = await prisma.shiftConfig.create({
      data: {
        roleId: telecallerRole.id,
        userId: null, // Role-based, not user-specific
        shiftStart: "09:30",
        shiftEnd: "17:30",
        isActive: true,
      },
    });
    console.log(`✅ Created shift config for TELECALLER:`, {
      id: shiftConfig.id,
      shiftStart: shiftConfig.shiftStart,
      shiftEnd: shiftConfig.shiftEnd,
    });
  }

  console.log("✅ Shift configuration seeding completed!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding shift config:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
