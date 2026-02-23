-- AlterTable: Add roleId to workflows table
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "roleId" TEXT;

-- CreateIndex: Add index on roleId for role-based workflow lookup
CREATE INDEX IF NOT EXISTS "workflows_roleId_idx" ON "workflows"("roleId");

-- AddForeignKey: Add foreign key relation to roles table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workflows_roleId_fkey'
    ) THEN
        ALTER TABLE "workflows" 
        ADD CONSTRAINT "workflows_roleId_fkey" 
        FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
