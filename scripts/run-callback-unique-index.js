#!/usr/bin/env node
/**
 * Run the unique index migration for tag_applications (appliedById, callbackAt) WHERE isActive.
 * Prevents race condition where two parallel requests pick the same callback slot.
 *
 * Usage:
 *   node scripts/run-callback-unique-index.js
 *   Or use Prisma (recommended): npx prisma db execute --file <sql file>
 *
 * SQLite:  prisma/migrations/add_unique_applied_callback_at_for_active/migration.sql
 * Postgres: npx prisma db execute --file prisma/migrations/add_unique_applied_callback_at_for_active/migration_postgres.sql
 *
 * If Postgres fails with P2002 (unique constraint), you have duplicate (appliedById, callbackAt)
 * in active rows. Fix duplicates first (e.g. run stagger/backfill), then re-run.
 */

console.log("Run the migration with Prisma:");
console.log("");
console.log("  PostgreSQL (current DB):");
console.log('  npx prisma db execute --file prisma/migrations/add_unique_applied_callback_at_for_active/migration_postgres.sql');
console.log("");
console.log("  SQLite (if using dev.db):");
console.log('  npx prisma db execute --file prisma/migrations/add_unique_applied_callback_at_for_active/migration.sql');
console.log("");
console.log("If you get P2002 (unique constraint), existing data has duplicate (appliedById, callbackAt).");
console.log("Resolve duplicates (e.g. stagger those callbacks) then run the migration again.");
