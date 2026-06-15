-- Add email open tracking fields to email_logs
ALTER TABLE "email_logs" ADD COLUMN "trackingToken" TEXT;
ALTER TABLE "email_logs" ADD COLUMN "openedAt" TIMESTAMP(3);

-- Unique constraint for trackingToken
CREATE UNIQUE INDEX "email_logs_trackingToken_key" ON "email_logs"("trackingToken");
