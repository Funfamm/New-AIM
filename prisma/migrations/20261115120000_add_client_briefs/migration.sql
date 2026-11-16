-- Additive only: one enum and two new tables. No existing table is touched.

-- CreateEnum
CREATE TYPE "ClientBriefStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED');

-- CreateTable
CREATE TABLE "client_briefs" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "club" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "status" "ClientBriefStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "submittedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_brief_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "rates" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_brief_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_briefs_token_key" ON "client_briefs"("token");

-- CreateIndex
CREATE INDEX "client_briefs_status_updatedAt_idx" ON "client_briefs"("status", "updatedAt");
