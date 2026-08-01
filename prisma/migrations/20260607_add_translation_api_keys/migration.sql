-- Translation API Keys
-- Encrypted pool of Gemini API keys for subtitle translation.
-- Applied via: npx prisma db execute --file ... && npx prisma migrate resolve --applied ...

CREATE TABLE "translation_api_keys" (
    "id"            TEXT NOT NULL,
    "provider"      TEXT NOT NULL DEFAULT 'gemini',
    "name"          TEXT NOT NULL,
    "encryptedKey"  TEXT NOT NULL,
    "keyPreview"    TEXT,
    "isEnabled"     BOOLEAN NOT NULL DEFAULT true,
    "status"        TEXT NOT NULL DEFAULT 'HEALTHY',
    "failureCount"  INTEGER NOT NULL DEFAULT 0,
    "successCount"  INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt"    TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "cooldownUntil" TIMESTAMP(3),
    "errorMessage"  TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "translation_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "translation_api_keys_provider_isEnabled_status_idx"
    ON "translation_api_keys"("provider", "isEnabled", "status");
