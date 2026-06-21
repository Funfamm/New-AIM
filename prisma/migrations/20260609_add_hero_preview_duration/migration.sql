-- AlterTable: add heroPreviewDuration to works
-- Nullable Int — null means "use 12 s default in UI"
ALTER TABLE "works" ADD COLUMN "heroPreviewDuration" INTEGER;
