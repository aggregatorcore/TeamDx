-- AlterTable: Lead exhaust state when no telecaller in pool (EXHAUST bucket, Senior only)
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "isExhausted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "exhaustedAt" TIMESTAMP(3);
