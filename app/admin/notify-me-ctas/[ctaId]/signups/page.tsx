import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { isAcsConfigured } from "@/lib/bulk-email";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, BellRing } from "lucide-react";
import SendNoticeButton from "./send-notice-button";
import type { Metadata } from "next";
import "./signups.css";

export const metadata: Metadata = { title: "Admin — CTA Signups" };

const PAGE_SIZE = 50;

const CTA_TYPE_LABEL: Record<string, string> = {
  RELEASE: "Pre-Release",
  MORE: "Watch More",
  POST_RELEASE: "Post-Release",
};

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function buildWhere(ctaId: string, q: string, status: string) {
  const where: Record<string, unknown> = { ctaId };

  if (q.trim()) {
    where.OR = [
      { email: { contains: q.trim(), mode: "insensitive" } },
      { name:  { contains: q.trim(), mode: "insensitive" } },
    ];
  }

  if (status === "guest")   where.userId = null;
  if (status === "member")  where.userId = { not: null };
  if (status === "pending") where.notifyEmailSentAt = null;
  if (status === "sent")    where.notifyEmailSentAt = { not: null };
  if (status === "inapp")   where.notifyInAppSentAt = { not: null };
  if (status === "failed")  where.notifyFailCount   = { gt: 0 };

  return where;
}

function orderBy(sort: string) {
  if (sort === "oldest") return { createdAt: "asc"  as const };
  if (sort === "fails")  return { notifyFailCount: "desc" as const };
  if (sort === "email")  return { email: "asc" as const };
  return { createdAt: "desc" as const };
}

function pageUrl(
  ctaId: string, p: number, q: string, status: string, sort: string,
) {
  const sp = new URLSearchParams();
  if (q)               sp.set("q",      q);
  if (status)          sp.set("status", status);
  if (sort !== "newest") sp.set("sort", sort);
  if (p > 1)           sp.set("page",   String(p));
  const qs = sp.toString();
  return `/admin/notify-me-ctas/${ctaId}/signups${qs ? `?${qs}` : ""}`;
}

type Props = {
  params:       Promise<{ ctaId: string }>;
  searchParams: Promise<Record<string, string>>;
};

export default async function CtaSignupsPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) redirect("/login");

  const { ctaId } = await params;
  const sp        = await searchParams;
  const q         = sp.q      ?? "";
  const status    = sp.status ?? "";
  const sort      = sp.sort   ?? "newest";
  const page      = Math.max(1, parseInt(sp.page ?? "1", 10));

  const cta = await prisma.notifyMeCta.findUnique({
    where:  { id: ctaId },
    select: {
      id: true, type: true, headline: true, ctaLabel: true,
      work: { select: { title: true, type: true, slug: true } },
    },
  });
  if (!cta) notFound();

  const where      = buildWhere(ctaId, q, status);
  const isFiltered = !!(q || status);

  const [
    total,
    guests,
    members,
    pending,
    emailSent,
    inAppSent,
    failed,
    filteredTotal,
    signups,
  ] = await Promise.all([
    prisma.notifyMeSignup.count({ where: { ctaId } }),
    prisma.notifyMeSignup.count({ where: { ctaId, userId: null } }),
    prisma.notifyMeSignup.count({ where: { ctaId, userId: { not: null } } }),
    prisma.notifyMeSignup.count({ where: { ctaId, notifyEmailSentAt: null } }),
    prisma.notifyMeSignup.count({ where: { ctaId, notifyEmailSentAt: { not: null } } }),
    prisma.notifyMeSignup.count({ where: { ctaId, notifyInAppSentAt: { not: null } } }),
    prisma.notifyMeSignup.count({ where: { ctaId, notifyFailCount: { gt: 0 } } }),
    prisma.notifyMeSignup.count({ where }),
    prisma.notifyMeSignup.findMany({
      where,
      orderBy: orderBy(sort),
      skip:    (page - 1) * PAGE_SIZE,
      take:    PAGE_SIZE,
      select: {
        id: true, email: true, name: true, userId: true,
        notifyEmailSentAt: true, notifyInAppSentAt: true,
        notifyFailCount: true, createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  const totalPages = Math.ceil(filteredTotal / PAGE_SIZE);

  return (
    <div className="nms-page">

      {/* ── Back ── */}
      <Link href={`/admin/notify-me-ctas/${ctaId}`} className="nms-back">
        <ChevronLeft size={14} /> Edit CTA
      </Link>

      {/* ── Header ── */}
      <div className="nms-header">
        <div className="nms-title-block">
          <div className="nms-title-row">
            <BellRing size={16} className="nms-icon" />
            <h1 className="nms-title">{cta.work.title}</h1>
            <span className="nms-type-chip">{CTA_TYPE_LABEL[cta.type] ?? cta.type}</span>
          </div>
          <p className="nms-subtitle">&ldquo;{cta.headline}&rdquo; · {cta.ctaLabel}</p>
        </div>
        <div className="nms-header-right">
          <span className="nms-count-badge">
            {isFiltered ? `${filteredTotal} of ${total}` : `${total} total`}
          </span>
          <SendNoticeButton ctaId={ctaId} total={total} acsReady={isAcsConfigured()} />
          <a
            href={`/api/admin/notify-me-ctas/${ctaId}/signups/export`}
            className="nms-export-btn"
          >
            Export CSV
          </a>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="nms-stat-grid">
        <div className="nms-stat-card">
          <div className="nms-stat-value">{total}</div>
          <div className="nms-stat-label">Total</div>
        </div>
        <div className="nms-stat-card nms-stat-card--muted">
          <div className="nms-stat-value">{guests}</div>
          <div className="nms-stat-label">Guests</div>
        </div>
        <div className="nms-stat-card nms-stat-card--purple">
          <div className="nms-stat-value">{members}</div>
          <div className="nms-stat-label">Members</div>
        </div>
        <div className="nms-stat-card nms-stat-card--gold">
          <div className="nms-stat-value">{pending}</div>
          <div className="nms-stat-label">Pending</div>
        </div>
        <div className="nms-stat-card nms-stat-card--green">
          <div className="nms-stat-value">{emailSent}</div>
          <div className="nms-stat-label">Email Sent</div>
        </div>
        <div className="nms-stat-card nms-stat-card--purple">
          <div className="nms-stat-value">{inAppSent}</div>
          <div className="nms-stat-label">In-App Sent</div>
        </div>
        <div className={`nms-stat-card${failed > 0 ? " nms-stat-card--red" : ""}`}>
          <div className="nms-stat-value">{failed}</div>
          <div className="nms-stat-label">Failed</div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <form
        method="GET"
        action={`/admin/notify-me-ctas/${ctaId}/signups`}
        className="nms-toolbar"
      >
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search email or name…"
          className="nms-search"
        />
        <select name="status" defaultValue={status} className="nms-select">
          <option value="">All types</option>
          <option value="guest">Guest</option>
          <option value="member">Member</option>
          <option value="pending">Pending</option>
          <option value="sent">Email sent</option>
          <option value="inapp">In-app sent</option>
          <option value="failed">Failed</option>
        </select>
        <select name="sort" defaultValue={sort} className="nms-select">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="fails">Failures</option>
          <option value="email">Email A–Z</option>
        </select>
        <button type="submit" className="nms-filter-btn">Filter</button>
        {isFiltered && (
          <Link href={`/admin/notify-me-ctas/${ctaId}/signups`} className="nms-clear-btn">
            Clear
          </Link>
        )}
      </form>

      {/* ── Table / Empty ── */}
      {signups.length === 0 ? (
        <div className="nms-empty-panel">
          <div className="nms-empty-dot" aria-hidden="true" />
          <p className="nms-empty-heading">
            {isFiltered ? "No signups match this filter." : "No signups yet."}
          </p>
          <p className="nms-empty-body">
            {isFiltered
              ? "Try adjusting your search or filter."
              : "Signups appear here when viewers interact with this Notify Me CTA during playback."}
          </p>
        </div>
      ) : (
        <div className="nms-table-panel">
          <div className="nms-table-scroll">
            <table className="nms-table">
              <thead>
                <tr>
                  <th>Name / Email</th>
                  <th>Type</th>
                  <th>Signed Up</th>
                  <th>Email Sent</th>
                  <th>In-App</th>
                  <th>Fails</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {signups.map((s) => {
                  const isGuest    = s.userId === null;
                  const displayName  = s.user?.name  ?? s.name  ?? null;
                  const displayEmail = s.user?.email ?? s.email;

                  let statusLabel:   string;
                  let statusVariant: string;
                  if (s.notifyFailCount > 0) {
                    statusLabel   = "Failed";
                    statusVariant = "nms-badge--failed";
                  } else if (s.notifyInAppSentAt) {
                    statusLabel   = "In-app sent";
                    statusVariant = "nms-badge--inapp";
                  } else if (s.notifyEmailSentAt) {
                    statusLabel   = "Email Sent";
                    statusVariant = "nms-badge--sent";
                  } else {
                    statusLabel   = "Pending";
                    statusVariant = "nms-badge--pending";
                  }

                  return (
                    <tr key={s.id}>
                      <td className="nms-td nms-td--name">
                        {displayName && (
                          <span className="nms-display-name">{displayName}</span>
                        )}
                        <span className="nms-display-email">{displayEmail}</span>
                      </td>
                      <td className="nms-td">
                        {isGuest
                          ? <span className="nms-type-guest">Guest</span>
                          : <span className="nms-type-member">Member</span>}
                      </td>
                      <td className="nms-td nms-td--date">{fmtDate(s.createdAt)}</td>
                      <td className="nms-td nms-td--date">{fmtDate(s.notifyEmailSentAt)}</td>
                      <td className="nms-td nms-td--date">{fmtDate(s.notifyInAppSentAt)}</td>
                      <td className="nms-td nms-td--num">
                        {s.notifyFailCount > 0
                          ? <span className="nms-fails">{s.notifyFailCount}</span>
                          : <span className="nms-dim">0</span>}
                      </td>
                      <td className="nms-td">
                        <span className={`nms-badge ${statusVariant}`}>{statusLabel}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="upagination">
          {page > 1 ? (
            <Link href={pageUrl(ctaId, page - 1, q, status, sort)} className="upag-btn">← Prev</Link>
          ) : (
            <span className="upag-btn upag-btn--disabled">← Prev</span>
          )}
          <span className="upag-info">
            Page {page} of {totalPages}
            {isFiltered && <span className="upag-sub"> · {filteredTotal} matching</span>}
          </span>
          {page < totalPages ? (
            <Link href={pageUrl(ctaId, page + 1, q, status, sort)} className="upag-btn">Next →</Link>
          ) : (
            <span className="upag-btn upag-btn--disabled">Next →</span>
          )}
        </div>
      )}

    </div>
  );
}
