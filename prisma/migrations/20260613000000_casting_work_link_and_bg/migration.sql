-- Casting Correction Pass — Phase 2 Schema
-- Adds optional Work link to CastingRole and casting background URL to AdminSettings

-- AlterTable
ALTER TABLE "admin_settings" ADD COLUMN "castingBackgroundUrl" TEXT;

-- AlterTable
ALTER TABLE "casting_roles" ADD COLUMN "workId" TEXT;

-- CreateIndex
CREATE INDEX "casting_roles_workId_idx" ON "casting_roles"("workId");

-- AddForeignKey
ALTER TABLE "casting_roles" ADD CONSTRAINT "casting_roles_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE SET NULL ON UPDATE CASCADE;
