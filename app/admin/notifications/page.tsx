// /admin/notifications — announcement composer + in-app notification broadcast
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import AnnouncementForm from "./announcement-form";
import AnnouncementActions from "./announcement-actions";
import type { Metadata } from "next";
import "./notifications-admin.css";

export const metadata: Metadata = { title: "Notifications — Admin" };

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export default async function AdminNotificationsPage() {
  const acsConfigured = !!(
    process.env.ACS_CONNECTION_STRING &&
    process.env.ACS_SENDER_ADDRESS
  );
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") notFound();

  const [announcements, inAppTotal] = await Promise.all([
    prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
      take:    50,
    }),
    prisma.notification.count(),
  ]);

  const activeUserCount = await prisma.user.count({ where: { status: "ACTIVE" } });

  return (
    <div className="notif-page">
      <h1 className="admin-page-title">Notifications</h1>
      <p className="notif-sub">
        Compose studio announcements and broadcast in-app notifications to all users.
      </p>

      {/* ── Stats ─────────────────────────────────────── */}
      <section className="notif-section">
        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--color-brand-white)" }}>
              {activeUserCount}
            </p>
            <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-brand-muted)" }}>
              Active users
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--color-brand-white)" }}>
              {inAppTotal}
            </p>
            <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-brand-muted)" }}>
              In-app notifications sent (all time)
            </p>
          </div>
        </div>
      </section>

      {/* ── Compose ───────────────────────────────────── */}
      <section className="notif-section">
        <h2 className="notif-section-title">Create announcement</h2>
        <p className="notif-hint">
          Announcements are saved as drafts. Publish to broadcast in-app notifications
          to all active users. Check &ldquo;Send email&rdquo; to also queue bulk email via ACS.
        </p>

        {!acsConfigured && (
          <p className="notif-hint" style={{ color: "#f59e0b", marginBottom: "1rem" }}>
            ⚠ ACS not configured — email option will fail. In-app notifications always work.
          </p>
        )}

        <AnnouncementForm acsConfigured={acsConfigured} />
      </section>

      {/* ── Announcement list ─────────────────────────── */}
      <section className="notif-section">
        <h2 className="notif-section-title">
          Announcements ({announcements.length})
        </h2>

        {announcements.length === 0 ? (
          <p className="notif-empty">No announcements yet. Create one above.</p>
        ) : (
          <div className="notif-list">
            {announcements.map((a) => (
              <div
                key={a.id}
                className={`notif-card${a.publishedAt ? " notif-card--published" : ""}`}
              >
                <div className="notif-card-head">
                  <h3 className="notif-card-title">{a.title}</h3>
                  <div className="notif-card-badges">
                    <span className={`notif-badge ${a.publishedAt ? "notif-badge--published" : "notif-badge--draft"}`}>
                      {a.publishedAt ? "Published" : "Draft"}
                    </span>
                    {a.sendInApp && (
                      <span className="notif-badge notif-badge--inapp">In-app</span>
                    )}
                    {a.sendEmail && (
                      <span className="notif-badge notif-badge--email">Email</span>
                    )}
                  </div>
                </div>

                <p className="notif-card-body">{a.body}</p>

                <div className="notif-card-meta">
                  <span>Created {fmtDate(a.createdAt)}</span>
                  {a.publishedAt && <span>Published {fmtDate(a.publishedAt)}</span>}
                  {a.emailSentAt && <span>Email queued {fmtDate(a.emailSentAt)}</span>}
                  {a.expiresAt   && <span>Expires {fmtDate(a.expiresAt)}</span>}
                  {a.href        && <span>Link: {a.href}</span>}
                </div>

                <AnnouncementActions id={a.id} isPublished={!!a.publishedAt} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
