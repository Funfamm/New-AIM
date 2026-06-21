-- AlterTable
ALTER TABLE "subscribers" ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "country" TEXT,
ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "failedSendCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "referrer" TEXT,
ADD COLUMN     "sourcePath" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "subscribers_countryCode_idx" ON "subscribers"("countryCode");

-- CreateIndex
CREATE INDEX "subscribers_subscribedAt_idx" ON "subscribers"("subscribedAt");
