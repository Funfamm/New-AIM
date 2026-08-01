-- Add quota-tracking fields to translation_api_keys
-- Safe additive migration — existing rows get default values
-- windowMaxCalls=50, usedInWindow=0, windowResetAt=NULL (treated as window expired → full quota)

ALTER TABLE "translation_api_keys"
ADD COLUMN "windowMaxCalls" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN "usedInWindow"   INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "windowResetAt"  TIMESTAMP(3);
