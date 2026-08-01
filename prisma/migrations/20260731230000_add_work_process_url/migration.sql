-- Behind-the-scenes / production-breakdown URL per work.
-- Additive and nullable: no backfill, no default, no rewrite of existing rows,
-- so this is a safe single-step migration (no two-step needed).
ALTER TABLE "works" ADD COLUMN "processUrl" TEXT;
