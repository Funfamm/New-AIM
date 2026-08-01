-- Step 2 of the two-step retirement of the legacy `resolved` boolean (superseded by
-- `status`). Step 1 (deploy 74e957d) removed all code that read/wrote it; this drops
-- the column and its index. `resolvedAt` / `resolvedBy` are retained.

-- DropIndex
DROP INDEX "error_logs_resolved_lastSeenAt_idx";

-- AlterTable
ALTER TABLE "error_logs" DROP COLUMN "resolved";
