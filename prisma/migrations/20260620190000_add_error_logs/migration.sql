-- CreateEnum
CREATE TYPE "ErrorLevel" AS ENUM ('WARN', 'ERROR', 'FATAL');

-- CreateEnum
CREATE TYPE "ErrorSource" AS ENUM ('SERVER', 'CLIENT', 'API', 'ACTION', 'WORKER');

-- CreateTable
CREATE TABLE "error_logs" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "level" "ErrorLevel" NOT NULL DEFAULT 'ERROR',
    "source" "ErrorSource" NOT NULL DEFAULT 'SERVER',
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "route" TEXT,
    "method" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "lastUserId" TEXT,
    "metadata" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "error_logs_fingerprint_key" ON "error_logs"("fingerprint");

-- CreateIndex
CREATE INDEX "error_logs_resolved_lastSeenAt_idx" ON "error_logs"("resolved", "lastSeenAt");

-- CreateIndex
CREATE INDEX "error_logs_level_lastSeenAt_idx" ON "error_logs"("level", "lastSeenAt");

-- CreateIndex
CREATE INDEX "error_logs_lastSeenAt_idx" ON "error_logs"("lastSeenAt");
