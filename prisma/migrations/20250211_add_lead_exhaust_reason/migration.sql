-- Add exhaustReason to leads (WRONG_NUMBER, POOL_EXHAUSTED, etc.) for senior Exhaust bucket badge
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "exhaustReason" TEXT;
