-- Add exhaust columns to leads table (run this once if migration wasn't applied)
-- Run with: psql -U your_user -d immigration_db -f scripts/add-lead-exhaust-columns.sql
-- Or paste into pgAdmin / any PostgreSQL client connected to your DB.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'isExhausted') THEN
    ALTER TABLE "leads" ADD COLUMN "isExhausted" BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'exhaustedAt') THEN
    ALTER TABLE "leads" ADD COLUMN "exhaustedAt" TIMESTAMP(3);
  END IF;
END $$;
