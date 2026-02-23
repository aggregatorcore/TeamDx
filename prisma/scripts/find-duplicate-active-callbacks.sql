-- Find duplicate active callbacks: same (appliedById, callbackAt) with isActive=true and callbackAt not null.
-- Run in Postgres DB console before applying the unique index. Export this list for Pooja report.
-- Expected: 0 rows = no duplicates; >0 = must fix before UNIQUE index.

SELECT
  "appliedById",
  "callbackAt",
  COUNT(*) AS duplicate_count,
  array_agg("id" ORDER BY "createdAt") AS tag_application_ids,
  array_agg("entityId" ORDER BY "createdAt") AS lead_ids,
  array_agg("createdAt" ORDER BY "createdAt") AS created_ats
FROM "tag_applications"
WHERE "isActive" = true
  AND "callbackAt" IS NOT NULL
  AND "entityType" = 'lead'
GROUP BY "appliedById", "callbackAt"
HAVING COUNT(*) > 1
ORDER BY "appliedById", "callbackAt";

-- Detailed rows for Pooja report (id, leadId, appliedById, callbackAt, createdAt) — run after first query to get full row list:
-- SELECT ta.id, ta."entityId" AS "leadId", ta."appliedById", ta."callbackAt", ta."createdAt"
-- FROM "tag_applications" ta
-- INNER JOIN (
--   SELECT "appliedById", "callbackAt"
--   FROM "tag_applications"
--   WHERE "isActive" = true AND "callbackAt" IS NOT NULL AND "entityType" = 'lead'
--   GROUP BY "appliedById", "callbackAt"
--   HAVING COUNT(*) > 1
-- ) dup ON dup."appliedById" = ta."appliedById" AND dup."callbackAt" = ta."callbackAt"
-- WHERE ta."isActive" = true AND ta."callbackAt" IS NOT NULL AND ta."entityType" = 'lead'
-- ORDER BY ta."appliedById", ta."callbackAt", ta."createdAt";
