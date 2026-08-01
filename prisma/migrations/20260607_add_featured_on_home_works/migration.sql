-- Add separate hero-featuring controls for homepage and works page
ALTER TABLE "works" ADD COLUMN "featuredOnHome"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "works" ADD COLUMN "featuredOnWorks" BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing homepage hero works (featured=true AND showOnHome=true) to new field
UPDATE "works" SET "featuredOnHome" = true WHERE featured = true AND "showOnHome" = true;
