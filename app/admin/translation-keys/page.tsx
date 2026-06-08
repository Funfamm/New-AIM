import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import TranslationKeysClient from "./translation-keys-client";
import "./translation-keys.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin — Translation Keys" };

export default async function TranslationKeysPage() {
  await requireAdmin();

  const keys = await prisma.translationApiKey.findMany({
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true, provider: true, name: true, keyPreview: true,
      isEnabled: true, status: true, failureCount: true, successCount: true,
      lastUsedAt: true, lastSuccessAt: true, lastFailureAt: true,
      cooldownUntil: true, errorMessage: true, createdAt: true, updatedAt: true,
    },
  });

  return (
    <div className="tk-page">
      <TranslationKeysClient initialKeys={keys.map((k) => ({
        ...k,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        lastSuccessAt: k.lastSuccessAt?.toISOString() ?? null,
        lastFailureAt: k.lastFailureAt?.toISOString() ?? null,
        cooldownUntil: k.cooldownUntil?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
      }))} />
    </div>
  );
}
