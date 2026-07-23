import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function csvEscape(v: string | number | null | undefined): string {
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

type RouteContext = { params: Promise<{ ctaId: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user || !isAdminRole((session.user as { role?: string }).role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { ctaId } = await params;

  const cta = await prisma.notifyMeCta.findUnique({
    where:  { id: ctaId },
    select: { ctaLabel: true, work: { select: { title: true } } },
  });
  if (!cta) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const signups = await prisma.notifyMeSignup.findMany({
    where:    { ctaId },
    orderBy:  { createdAt: "desc" },
    select: {
      email: true, name: true, userId: true,
      notifyEmailSentAt: true, notifyInAppSentAt: true,
      notifyFailCount: true, createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  const header = [
    "workTitle", "ctaLabel",
    "name", "email", "type",
    "signedUpAt", "emailSentAt", "inAppSentAt",
    "failCount", "status",
  ].join(",");

  const lines = signups.map((s) => {
    const isGuest      = s.userId === null;
    const displayName  = s.user?.name  ?? s.name  ?? "";
    const displayEmail = s.user?.email ?? s.email;

    let status: string;
    if (s.notifyFailCount > 0)     status = "failed";
    else if (s.notifyInAppSentAt)  status = "inapp_sent";
    else if (s.notifyEmailSentAt)  status = "email_sent";
    else                           status = "pending";

    return [
      csvEscape(cta.work.title),
      csvEscape(cta.ctaLabel),
      csvEscape(displayName),
      csvEscape(displayEmail),
      csvEscape(isGuest ? "guest" : "member"),
      csvEscape(fmtIso(s.createdAt)),
      csvEscape(fmtIso(s.notifyEmailSentAt)),
      csvEscape(fmtIso(s.notifyInAppSentAt)),
      csvEscape(s.notifyFailCount),
      csvEscape(status),
    ].join(",");
  });

  const csv = [header, ...lines].join("\n");
  const slug = cta.work.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const filename = `notifyme-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    },
  });
}
