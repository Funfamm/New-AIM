-- CreateEnum
CREATE TYPE "CastingApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_AGENT_REVIEW', 'READY_FOR_ADMIN_REVIEW', 'REQUIREMENTS_NOT_MET', 'SHORTLISTED', 'CONTACTED', 'SELECTED', 'NOT_SELECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CastingMediaType" AS ENUM ('IMAGE', 'AUDIO');

-- CreateEnum
CREATE TYPE "CastingAgentRecommendation" AS ENUM ('PASS', 'FAIL', 'MANUAL_REVIEW');

-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE 'CASTING_RECEIVED';
ALTER TYPE "EmailType" ADD VALUE 'CASTING_REQUIREMENTS_NOT_MET';
ALTER TYPE "EmailType" ADD VALUE 'CASTING_READY_FOR_REVIEW';
ALTER TYPE "EmailType" ADD VALUE 'CASTING_SHORTLISTED';
ALTER TYPE "EmailType" ADD VALUE 'CASTING_CONTACTED';
ALTER TYPE "EmailType" ADD VALUE 'CASTING_SELECTED';
ALTER TYPE "EmailType" ADD VALUE 'CASTING_NOT_SELECTED';
ALTER TYPE "EmailType" ADD VALUE 'CASTING_WITHDRAWN';

-- AlterTable
ALTER TABLE "translation_api_keys" ADD COLUMN "taskScopes" TEXT[] DEFAULT ARRAY['TRANSLATION']::TEXT[];

-- CreateTable
CREATE TABLE "casting_roles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "requireGender" BOOLEAN NOT NULL DEFAULT false,
    "allowedGender" TEXT,
    "requireAgeRange" BOOLEAN NOT NULL DEFAULT false,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "requireVoiceSample" BOOLEAN NOT NULL DEFAULT true,
    "minAgentScore" INTEGER NOT NULL DEFAULT 70,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "casting_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casting_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "trackingToken" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "socialHandle" TEXT NOT NULL,
    "roleInterest" TEXT NOT NULL,
    "shortNote" TEXT NOT NULL,
    "gender" TEXT,
    "ageRange" TEXT,
    "consentAccepted" BOOLEAN NOT NULL DEFAULT false,
    "policyAccepted" BOOLEAN NOT NULL DEFAULT false,
    "isAdultConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "unpaidAccepted" BOOLEAN NOT NULL DEFAULT false,
    "likenessReleaseAccepted" BOOLEAN NOT NULL DEFAULT false,
    "withdrawalTermsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "policyVersion" TEXT,
    "policyAcceptedAt" TIMESTAMP(3),
    "releaseAcceptedAt" TIMESTAMP(3),
    "consentAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" "CastingApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewStartedAt" TIMESTAMP(3),
    "readyForReviewAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),
    "decisionById" TEXT,
    "decisionReason" TEXT,
    "requirementsReason" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "lastResubmittedAt" TIMESTAMP(3),
    "resubmissionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "casting_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casting_application_media" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "CastingMediaType" NOT NULL,
    "r2Key" TEXT NOT NULL,
    "originalFilename" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isValid" BOOLEAN,
    "validationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "casting_application_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casting_agent_reviews" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "photoScore" INTEGER NOT NULL,
    "voiceScore" INTEGER NOT NULL,
    "socialScore" INTEGER NOT NULL,
    "formScore" INTEGER NOT NULL,
    "recommendation" "CastingAgentRecommendation" NOT NULL,
    "summary" TEXT NOT NULL,
    "imageReview" TEXT NOT NULL,
    "audioReview" TEXT NOT NULL,
    "socialResult" TEXT NOT NULL,
    "roleMatchResult" TEXT NOT NULL,
    "suggestedAction" TEXT NOT NULL,
    "imageReviewJson" JSONB,
    "audioReviewJson" JSONB,
    "scoreBreakdown" JSONB,
    "missingItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "casting_agent_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casting_application_notes" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "casting_application_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "casting_roles_slug_key" ON "casting_roles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "casting_applications_trackingToken_key" ON "casting_applications"("trackingToken");

-- CreateIndex
CREATE INDEX "casting_applications_status_idx" ON "casting_applications"("status");

-- CreateIndex
CREATE INDEX "casting_applications_roleId_idx" ON "casting_applications"("roleId");

-- CreateIndex
CREATE INDEX "casting_applications_trackingToken_idx" ON "casting_applications"("trackingToken");

-- CreateIndex
CREATE UNIQUE INDEX "casting_applications_userId_roleId_key" ON "casting_applications"("userId", "roleId");

-- CreateIndex
CREATE INDEX "casting_application_media_applicationId_idx" ON "casting_application_media"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "casting_agent_reviews_applicationId_key" ON "casting_agent_reviews"("applicationId");

-- CreateIndex
CREATE INDEX "casting_application_notes_applicationId_idx" ON "casting_application_notes"("applicationId");

-- AddForeignKey
ALTER TABLE "casting_applications" ADD CONSTRAINT "casting_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casting_applications" ADD CONSTRAINT "casting_applications_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "casting_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casting_applications" ADD CONSTRAINT "casting_applications_decisionById_fkey" FOREIGN KEY ("decisionById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casting_application_media" ADD CONSTRAINT "casting_application_media_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "casting_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casting_agent_reviews" ADD CONSTRAINT "casting_agent_reviews_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "casting_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casting_application_notes" ADD CONSTRAINT "casting_application_notes_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "casting_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casting_application_notes" ADD CONSTRAINT "casting_application_notes_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
