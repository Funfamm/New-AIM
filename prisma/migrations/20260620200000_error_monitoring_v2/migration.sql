-- CreateEnum
CREATE TYPE "ErrorStatus" AS ENUM ('NEW', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED', 'MUTED');

-- AlterTable (additive — all new columns nullable or defaulted)
ALTER TABLE "error_logs"
  ADD COLUMN "status" "ErrorStatus" NOT NULL DEFAULT 'NEW',
  ADD COLUMN "firstRelease" TEXT,
  ADD COLUMN "lastRelease" TEXT,
  ADD COLUMN "environment" TEXT,
  ADD COLUMN "regressed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "regressedAt" TIMESTAMP(3),
  ADD COLUMN "lastAlertedAt" TIMESTAMP(3),
  ADD COLUMN "assignedToId" TEXT,
  ADD COLUMN "assignedToEmail" TEXT,
  ADD COLUMN "mutedUntil" TIMESTAMP(3);

-- Backfill triage status from the legacy `resolved` flag (NEW is the default for the rest).
UPDATE "error_logs" SET "status" = 'RESOLVED' WHERE "resolved" = true;

-- CreateIndex
CREATE INDEX "error_logs_status_lastSeenAt_idx" ON "error_logs"("status", "lastSeenAt");

-- CreateTable
CREATE TABLE "error_event_buckets" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "error_event_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "error_event_buckets_fingerprint_bucketStart_key" ON "error_event_buckets"("fingerprint", "bucketStart");

-- CreateIndex
CREATE INDEX "error_event_buckets_fingerprint_bucketStart_idx" ON "error_event_buckets"("fingerprint", "bucketStart");

-- CreateIndex
CREATE INDEX "error_event_buckets_bucketStart_idx" ON "error_event_buckets"("bucketStart");

-- CreateTable
CREATE TABLE "error_notes" (
    "id" TEXT NOT NULL,
    "errorId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "error_notes_errorId_createdAt_idx" ON "error_notes"("errorId", "createdAt");

-- AddForeignKey
ALTER TABLE "error_notes" ADD CONSTRAINT "error_notes_errorId_fkey" FOREIGN KEY ("errorId") REFERENCES "error_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
