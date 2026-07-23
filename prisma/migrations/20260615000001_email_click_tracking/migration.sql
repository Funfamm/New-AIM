-- Add click tracking field to email_logs
ALTER TABLE "email_logs" ADD COLUMN "clickedAt" TIMESTAMP(3);
