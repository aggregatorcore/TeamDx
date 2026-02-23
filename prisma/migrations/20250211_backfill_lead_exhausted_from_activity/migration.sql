-- Backfill Lead.isExhausted and exhaustedAt from LeadActivity(EXHAUSTED) for leads that were exhausted before the column was set.
-- Safe to run multiple times (only updates where isExhausted is false and activity exists).
UPDATE "leads" l
SET "isExhausted" = true,
    "exhaustedAt" = sub."createdAt"
FROM (
  SELECT DISTINCT ON (la."leadId") la."leadId", la."createdAt"
  FROM "lead_activities" la
  WHERE la."activityType" = 'EXHAUSTED'
  ORDER BY la."leadId", la."createdAt" DESC
) sub
WHERE l.id = sub."leadId"
  AND (l."isExhausted" IS NOT TRUE OR l."exhaustedAt" IS NULL);
