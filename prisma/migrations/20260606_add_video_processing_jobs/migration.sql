-- Migration: add_video_processing_jobs
-- Adds VideoJobStatus enum, master_video_key column on works,
-- and video_processing_jobs table.
-- Additive only. No existing data modified.

-- 1. Create VideoJobStatus enum
CREATE TYPE "VideoJobStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'READY',
  'FAILED',
  'CANCELLED'
);

-- 2. Add masterVideoKey to works (nullable, no default — safe for existing rows)
ALTER TABLE "works"
  ADD COLUMN "masterVideoKey" TEXT;

-- 3. Create video_processing_jobs table
CREATE TABLE "video_processing_jobs" (
  "id"           TEXT         NOT NULL,
  "workId"       TEXT         NOT NULL,
  "sourceKey"    TEXT         NOT NULL,
  "outputPrefix" TEXT         NOT NULL,
  "status"       "VideoJobStatus" NOT NULL DEFAULT 'PENDING',
  "progress"     INTEGER      NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "hlsUrl"       TEXT,
  "attempts"     INTEGER      NOT NULL DEFAULT 0,
  "startedAt"    TIMESTAMP(3),
  "completedAt"  TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "video_processing_jobs_pkey" PRIMARY KEY ("id")
);

-- 4. Foreign key: workId → works.id (cascade delete)
ALTER TABLE "video_processing_jobs"
  ADD CONSTRAINT "video_processing_jobs_workId_fkey"
  FOREIGN KEY ("workId")
  REFERENCES "works"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 5. Indexes
CREATE INDEX "video_processing_jobs_status_createdAt_idx"
  ON "video_processing_jobs"("status", "createdAt");

CREATE INDEX "video_processing_jobs_workId_idx"
  ON "video_processing_jobs"("workId");
