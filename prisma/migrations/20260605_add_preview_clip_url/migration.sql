-- AddColumn previewClipUrl to Work model
ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "previewClipUrl" TEXT;
