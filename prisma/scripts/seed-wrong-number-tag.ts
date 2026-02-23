/**
 * One-off: Ensure "Wrong Number" TagFlow exists (category: call_status).
 * Run: npx tsx prisma/scripts/seed-wrong-number-tag.ts
 * Or:  npm run db:seed:wrong-number
 */
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

const WRONG_NUMBER_TAG = {
  name: "Wrong Number",
  description: "Wrong or invalid number; lead moved to Exhaust for senior review",
  tagValue: "wrong_number",
  icon: "wrongnumber",
  color: "#dc2626",
  category: "call_status",
  isActive: true,
  isExclusive: false,
  requiresNote: false,
  requiresCallback: false,
  requiresFollowUp: false,
  actions: JSON.stringify({
    moveTo: null,
    scheduleCallback: false,
    closeLead: true,
  }),
};

async function main() {
  try {
    await prisma.tagFlow.upsert({
      where: {
        tagValue_category: {
          tagValue: "wrong_number",
          category: "call_status",
        },
      },
      update: WRONG_NUMBER_TAG,
      create: WRONG_NUMBER_TAG,
    });
    console.log("✅ Wrong Number tag is present (call_status).");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
