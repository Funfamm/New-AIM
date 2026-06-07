-- Add masterTrailerKey and masterPreviewKey to works
ALTER TABLE "works" ADD COLUMN "masterTrailerKey" TEXT;
ALTER TABLE "works" ADD COLUMN "masterPreviewKey" TEXT;

-- Add targetField to video_processing_jobs (default "videoUrl" for all existing rows)
ALTER TABLE "video_processing_jobs" ADD COLUMN "targetField" TEXT NOT NULL DEFAULT 'videoUrl';
