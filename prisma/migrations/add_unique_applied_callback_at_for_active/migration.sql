-- Bulletproof: prevent race condition where 2 parallel requests pick same slot.
-- UNIQUE(appliedById, callbackAt) WHERE isActive = true
CREATE UNIQUE INDEX IF NOT EXISTS "tag_applications_applied_callback_active_unique"
ON "tag_applications" ("appliedById", "callbackAt")
WHERE "isActive" = true;
