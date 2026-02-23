-- AlterTable: No Answer shuffle escalation (dynamic telecaller pool)
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "shuffleTriedOwnerIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "shuffleIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lastHandoffAt" TIMESTAMP(3);
