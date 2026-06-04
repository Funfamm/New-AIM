import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function csvEscape(v: string | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmtIso(d: Date | null | undefined): string {
  return d ? d.toISOString() : "";
}

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.subscriber.findMany({
    orderBy: { subscribedAt: "desc" },
    select: {
      email: true, name: true, countryCode: true, country: true, language: true,
      source: true, sourcePath: true, active: true, suppressedAt: true,
      suppressReason: true, verifiedAt: true, subscribedAt: true,
      lastSeenAt: true, convertedAt: true, failedSendCount: true,
    },
  });

  const header = [
    "email", "name", "countryCode", "country", "language",
    "source", "sourcePath", "status", "suppressReason",
    "verifiedAt", "subscribedAt", "lastSeenAt", "convertedAt", "failedSendCount",
  ].join(",");

  const lines = rows.map((r) => {
    const status = r.suppressedAt ? "suppressed" : r.active ? "active" : "inactive";
    return [
      csvEscape(r.email),
      csvEscape(r.name),
      csvEscape(r.countryCode),
      csvEscape(r.country),
      csvEscape(r.language),
      csvEscape(r.source),
      csvEscape(r.sourcePath),
      csvEscape(status),
      csvEscape(r.suppressReason),
      csvEscape(fmtIso(r.verifiedAt)),
      csvEscape(fmtIso(r.subscribedAt)),
      csvEscape(fmtIso(r.lastSeenAt)),
      csvEscape(fmtIso(r.convertedAt)),
      csvEscape(String(r.failedSendCount)),
    ].join(",");
  });

  const csv = [header, ...lines].join("\n");
  const filename = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    },
  });
}
