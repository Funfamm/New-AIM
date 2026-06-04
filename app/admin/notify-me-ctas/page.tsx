import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BellRing, Plus, CheckCircle2, Circle, Pencil, Users } from "lucide-react";
import type { Metadata } from "next";
import "./notify-me-ctas.css";

export const metadata: Metadata = { title: "Admin — Notify Me CTAs" };

export default async function NotifyMeCtasPage() {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) redirect("/login");

  const ctas = await prisma.notifyMeCta.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, type: true, isEnabled: true,
      headline: true, ctaLabel: true, triggerSecondsFromEnd: true,
      createdAt: true,
      work: { select: { id: true, title: true, type: true, slug: true } },
      _count: { select: { signups: true } },
    },
  });

  const ctaIds = ctas.map((c) => c.id);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    recentCounts,
    guestCounts,
    memberCounts,
    sentCounts,
    pendingCounts,
    inAppCounts,
    failedCounts,
  ] = await Promise.all([
    prisma.notifyMeSignup.groupBy({
      by: ["ctaId"],
      where: { ctaId: { in: ctaIds }, createdAt: { gte: sevenDaysAgo } },
      _count: { id: true },
    }),
    prisma.notifyMeSignup.groupBy({
      by: ["ctaId"],
      where: { ctaId: { in: ctaIds }, userId: null },
      _count: { id: true },
    }),
    prisma.notifyMeSignup.groupBy({
      by: ["ctaId"],
      where: { ctaId: { in: ctaIds }, userId: { not: null } },
      _count: { id: true },
    }),
    prisma.notifyMeSignup.groupBy({
      by: ["ctaId"],
      where: { ctaId: { in: ctaIds }, notifyEmailSentAt: { not: null } },
      _count: { id: true },
    }),
    prisma.notifyMeSignup.groupBy({
      by: ["ctaId"],
      where: { ctaId: { in: ctaIds }, notifyEmailSentAt: null },
      _count: { id: true },
    }),
    prisma.notifyMeSignup.groupBy({
      by: ["ctaId"],
      where: { ctaId: { in: ctaIds }, notifyInAppSentAt: { not: null } },
      _count: { id: true },
    }),
    prisma.notifyMeSignup.groupBy({
      by: ["ctaId"],
      where: { ctaId: { in: ctaIds }, notifyFailCount: { gt: 0 } },
      _count: { id: true },
    }),
  ]);

  const toMap = (rows: { ctaId: string | null; _count: { id: number } }[]) =>
    new Map(rows.filter((r) => r.ctaId !== null).map((r) => [r.ctaId!, r._count.id]));

  const recentMap  = toMap(recentCounts);
  const guestMap   = toMap(guestCounts);
  const memberMap  = toMap(memberCounts);
  const sentMap    = toMap(sentCounts);
  const pendingMap = toMap(pendingCounts);
  const inAppMap   = toMap(inAppCounts);
  const failedMap  = toMap(failedCounts);

  const CTA_TYPE_LABEL: Record<string, string> = {
    RELEASE: "Pre-Release",
    MORE: "Watch More",
    POST_RELEASE: "Post-Release",
  };

  return (
    <div className="nmc-page">
      <div className="nmc-head">
        <div className="nmc-head-title">
          <BellRing size={18} />
          <h1>Notify Me CTAs</h1>
        </div>
        <Link href="/admin/notify-me-ctas/new" className="nmc-add-btn">
          <Plus size={14} /> New CTA
        </Link>
      </div>

      {ctas.length === 0 ? (
        <div className="nmc-empty">
          <BellRing size={32} strokeWidth={1.25} />
          <p>No CTAs yet. Create one to start capturing signups during playback.</p>
          <Link href="/admin/notify-me-ctas/new" className="nmc-add-btn">
            <Plus size={14} /> New CTA
          </Link>
        </div>
      ) : (
        <div className="nmc-table-wrap">
          <table className="nmc-table">
            <thead>
              <tr>
                <th>Work</th>
                <th>Type</th>
                <th>Status</th>
                <th>Signups</th>
                <th>Delivery</th>
                <th>Last 7 Days</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ctas.map((cta) => {
                const total   = cta._count.signups;
                const guest   = guestMap.get(cta.id)   ?? 0;
                const member  = memberMap.get(cta.id)  ?? 0;
                const sent    = sentMap.get(cta.id)    ?? 0;
                const pending = pendingMap.get(cta.id) ?? 0;
                const inApp   = inAppMap.get(cta.id)   ?? 0;
                const failed  = failedMap.get(cta.id)  ?? 0;

                return (
                  <tr key={cta.id}>
                    <td>
                      <div className="nmc-work-cell">
                        <span className="nmc-work-title">{cta.work.title}</span>
                        <span className="nmc-work-type">{cta.work.type.replace(/_/g, " ")}</span>
                      </div>
                    </td>
                    <td>
                      <span className="nmc-type-chip">{CTA_TYPE_LABEL[cta.type] ?? cta.type}</span>
                    </td>
                    <td>
                      {cta.isEnabled ? (
                        <span className="nmc-status nmc-status--active">
                          <CheckCircle2 size={12} /> Active
                        </span>
                      ) : (
                        <span className="nmc-status nmc-status--off">
                          <Circle size={12} /> Off
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="nmc-signup-cell">
                        <span className="nmc-signup-total">{total}</span>
                        {total > 0 && (
                          <span className="nmc-signup-breakdown">
                            {guest}g · {member}m
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {total === 0 ? (
                        <span className="nmc-delivery-none">—</span>
                      ) : (
                        <div className="nmc-delivery-cell">
                          {sent > 0 && (
                            <span className="nmc-delivery-chip nmc-delivery-chip--sent">{sent} sent</span>
                          )}
                          {pending > 0 && (
                            <span className="nmc-delivery-chip nmc-delivery-chip--pending">{pending} pending</span>
                          )}
                          {inApp > 0 && (
                            <span className="nmc-delivery-chip nmc-delivery-chip--inapp">{inApp} in‑app</span>
                          )}
                          {failed > 0 && (
                            <span className="nmc-delivery-chip nmc-delivery-chip--failed">{failed} failed</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="nmc-num">{recentMap.get(cta.id) ?? 0}</td>
                    <td>
                      <div className="nmc-actions-cell">
                        <Link
                          href={`/admin/notify-me-ctas/${cta.id}`}
                          className="nmc-edit-btn"
                          aria-label={`Edit CTA for ${cta.work.title}`}
                        >
                          <Pencil size={12} /> Edit
                        </Link>
                        {total > 0 && (
                          <Link
                            href={`/admin/notify-me-ctas/${cta.id}/signups`}
                            className="nmc-signups-btn"
                            aria-label={`View signups for ${cta.work.title}`}
                          >
                            <Users size={12} /> Signups
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
