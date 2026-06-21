-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'NOTIFY_ME';

-- AlterTable
ALTER TABLE "notify_me_signups" ADD COLUMN     "lastNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "notifyEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "notifyFailCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notifyInAppSentAt" TIMESTAMP(3),
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "notify_me_signups_userId_idx" ON "notify_me_signups"("userId");

-- AddForeignKey
ALTER TABLE "notify_me_signups" ADD CONSTRAINT "notify_me_signups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
