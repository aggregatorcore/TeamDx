-- PostgreSQL: unique index for (appliedById, callbackAt) WHERE isActive = true
CREATE UNIQUE INDEX IF NOT EXISTS "tag_applications_applied_callback_active_unique"
ON "tag_applications" ("appliedById", "callbackAt")
WHERE "isActive" = true;
