import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Activity, Users, Eye, Shield, MonitorPlay,
  VideoIcon, Mail, KeyRound, Bell, AlertTriangle,
  CheckCircle2, ArrowRight, Zap,
} from "lucide-react";
import type { Metadata } from "next";
import GlobalSearch from "@/components/admin/global-search";
import { dismissVideoJob, dismissSubtitleJob } from "@/lib/actions/admin-health";
import "@/components/admin/system-health.css";
import "@/components/admin/global-search.css";
import "./admin-overview.css";

export const metadata: Metadata = { title: "Admin — Command Center" };

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Late night";
}

// ── Queries ───────────────────────────────────────────────────────────────────

async function getStats() {
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const onlineCut  = new Date(now.getTime() - 2 * 60_000);

  const [
    totalWorks, publishedWorks, totalUsers, newThisMonth,
    onlineCount, onlineMembers,
    viewsToday, watchStartsToday,
    openAlerts, recentUsers,
  ] = await Promise.all([
    prisma.work.count({ where: { type: { not: "EPISODE" } } }),
    prisma.work.count({ where: { status: "PUBLISHED", type: { not: "EPISODE" } } }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.visitorSession.count({ where: { isBot: false, lastSeenAt: { gte: onlineCut } } }),
    prisma.visitorSession.count({ where: { isBot: false, lastSeenAt: { gte: onlineCut }, userId: { not: null } } }),
    prisma.analyticsEvent.count({ where: { type: "PAGE_VIEW",   createdAt: { gte: dayStart } } }),
    prisma.analyticsEvent.count({ where: { type: "WATCH_START", createdAt: { gte: dayStart } } }),
    prisma.securityAlert.count({ where: { status: "OPEN" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" }, take: 6,
      select: { id: true, name: true, email: true, createdAt: true, role: true },
    }),
  ]);

  return {
    totalWorks, publishedWorks, totalUsers, newThisMonth,
    onlineCount, onlineGuests: onlineCount - onlineMembers, onlineMembers,
    viewsToday, watchStartsToday, openAlerts, recentUsers,
  };
}

async function getSystemHealth() {
  const now         = new Date();
  const dayStart    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const stuckCutoff = new Date(now.getTime() - 15 * 60_000);

  const [
    videoPending, videoProcessing, videoFailed, videoStuck, videoReadyToday,
    emailQueued, emailFailed, emailLastSent,
    subPending, subProcessing, subFailed,
    keyHealthy, keyCooldown, keyInvalid,
    subscribersToday, notifyMeToday, usersToday,
  ] = await Promise.all([
    prisma.videoProcessingJob.count({ where: { status: "PENDING" } }),
    prisma.videoProcessingJob.count({ where: { status: "PROCESSING" } }),
    prisma.videoProcessingJob.count({ where: { status: "FAILED" } }),
    prisma.videoProcessingJob.count({ where: { status: "PROCESSING", updatedAt: { lt: stuckCutoff } } }),
    prisma.videoProcessingJob.count({ where: { status: "READY", updatedAt: { gte: dayStart } } }),

    prisma.emailQueue.count({ where: { status: "QUEUED" } }),
    prisma.emailQueue.count({ where: { status: "FAILED" } }),
    prisma.emailLog.findFirst({
      where: { status: "SENT" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),

    prisma.subtitleJob.count({ where: { status: "PENDING" } }),
    prisma.subtitleJob.count({ where: { status: "PROCESSING" } }),
    prisma.subtitleJob.count({ where: { status: "FAILED" } }),

    prisma.translationApiKey.count({ where: { status: "HEALTHY", isEnabled: true } }),
    prisma.translationApiKey.count({ where: { status: "COOLDOWN" } }),
    prisma.translationApiKey.count({
      where: { OR: [{ status: "INVALID" }, { status: "DISABLED" }, { isEnabled: false }] },
    }),

    prisma.subscriber.count({ where: { subscribedAt: { gte: dayStart } } }),
    prisma.notifyMeSignup.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.user.count({ where: { createdAt: { gte: dayStart } } }),
  ]);

  return {
    videoPending, videoProcessing, videoFailed, videoStuck, videoReadyToday,
    emailQueued, emailFailed,
    emailLastSentAt: emailLastSent?.createdAt ?? null,
    subPending, subProcessing, subFailed,
    keyHealthy, keyCooldown, keyInvalid,
    subscribersToday, notifyMeToday, usersToday,
  };
}

async function getNeedsAttention() {
  const stuckCutoff = new Date(Date.now() - 15 * 60_000);

  const [rawFailedVideoJobs, stuckVideoCount, failedSubJobs, badKeys, openAlerts] = await Promise.all([
    // Fetch FAILED video jobs — includes work's current URL fields so we can
    // filter out stale failures where the work was already re-uploaded.
    prisma.videoProcessingJob.findMany({
      where: { status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, targetField: true, errorMessage: true, updatedAt: true, attempts: true,
        work: {
          select: {
            id: true, title: true,
            videoUrl: true, trailerUrl: true, previewClipUrl: true,
          },
        },
      },
    }),
    prisma.videoProcessingJob.count({ where: { status: "PROCESSING", updatedAt: { lt: stuckCutoff } } }),
    // Only surface subtitle failures where NO READY job exists for the same
    // subtitle — if a later job succeeded, this failure is irrelevant.
    prisma.subtitleJob.findMany({
      where: {
        status: "FAILED",
        subtitle: { jobs: { none: { status: "READY" } } },
      },
      take: 3,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, error: true, updatedAt: true,
        subtitle: { select: { work: { select: { id: true, title: true } } } },
      },
    }),
    prisma.translationApiKey.findMany({
      where: { OR: [{ status: "INVALID" }, { status: "DISABLED" }] },
      select: { id: true, name: true, status: true, errorMessage: true },
    }),
    prisma.securityAlert.findMany({
      where: { status: "OPEN" },
      take: 3,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, severity: true, createdAt: true },
    }),
  ]);

  // Smart filter: only show a video-job failure if the work's relevant field
  // is still empty. If the field is set, a later upload resolved the issue.
  const failedVideoJobs = rawFailedVideoJobs.filter((j) => {
    if (!j.work) return true;
    const resolved: Record<string, string | null> = {
      videoUrl:      j.work.videoUrl,
      trailerUrl:    j.work.trailerUrl,
      previewClipUrl: j.work.previewClipUrl,
    };
    return !resolved[j.targetField];
  }).slice(0, 4);

  return { failedVideoJobs, stuckVideoCount, failedSubJobs, badKeys, openAlerts };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function healthStatus(critical: number, warning: number): "healthy" | "warning" | "critical" {
  if (critical > 0) return "critical";
  if (warning > 0)  return "warning";
  return "healthy";
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminOverviewPage() {
  const [
    { totalWorks, publishedWorks, totalUsers, newThisMonth, onlineCount, onlineGuests,
      onlineMembers, viewsToday, watchStartsToday, openAlerts, recentUsers },
    health,
    attention,
  ] = await Promise.all([getStats(), getSystemHealth(), getNeedsAttention()]);

  const greeting = getGreeting();

  const totalAttentionItems =
    (attention.stuckVideoCount > 0 ? 1 : 0) +
    attention.failedVideoJobs.length +
    attention.failedSubJobs.length +
    attention.badKeys.length +
    attention.openAlerts.length;

  return (
    <div className="admin-page">

      {/* ── Header ── */}
      <div className="cmd-header">
        <div>
          <p className="cmd-greeting">{greeting}, Director.</p>
          <h1 className="cmd-title">Studio Command Center</h1>
        </div>
        <div className="cmd-search-area">
          <GlobalSearch />
        </div>
      </div>

      {/* ── Live intelligence pills ── */}
      <div className="cmd-live-bar">
        <Link href="/admin/analytics/visitors" className="cmd-live-pill cmd-live-pill--online">
          <span className="cmd-live-dot" />
          <span className="cmd-live-val">{onlineCount}</span>
          <span className="cmd-live-lbl">Online Now</span>
        </Link>
        <div className="cmd-live-pill">
          <Users size={12} />
          <span className="cmd-live-val">{onlineMembers}</span>
          <span className="cmd-live-lbl">Members</span>
        </div>
        <div className="cmd-live-pill">
          <Eye size={12} />
          <span className="cmd-live-val">{onlineGuests}</span>
          <span className="cmd-live-lbl">Guests</span>
        </div>
        <div className="cmd-live-pill">
          <Activity size={12} />
          <span className="cmd-live-val">{viewsToday}</span>
          <span className="cmd-live-lbl">Views Today</span>
        </div>
        <div className="cmd-live-pill">
          <MonitorPlay size={12} />
          <span className="cmd-live-val">{watchStartsToday}</span>
          <span className="cmd-live-lbl">Watch Starts</span>
        </div>
        {openAlerts > 0 && (
          <Link href="/admin/security" className="cmd-live-pill cmd-live-pill--alert">
            <Shield size={12} />
            <span className="cmd-live-val">{openAlerts}</span>
            <span className="cmd-live-lbl">Open Alerts</span>
          </Link>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div className="cmd-stats">
        {[
          { label: "Total Works",    value: totalWorks,     note: "films & series" },
          { label: "Published",      value: publishedWorks, note: "live now" },
          { label: "Members",        value: totalUsers,     note: "registered" },
          { label: "New This Month", value: newThisMonth,   note: "recent signups" },
        ].map((s) => (
          <div key={s.label} className="cmd-stat">
            <div className="cmd-stat-value">{s.value}</div>
            <div className="cmd-stat-label">{s.label}</div>
            <div className="cmd-stat-note">{s.note}</div>
          </div>
        ))}
      </div>

      {/* ── System Health ── */}
      <div className="admin-section">
        <div className="admin-section-hd">
          <h2 className="admin-section-title cmd-section-with-icon">
            <Zap size={13} className="cmd-section-icon" />
            System Health
          </h2>
        </div>

        <div className="sh-grid">

          {/* Video Processing */}
          {(() => {
            const status = healthStatus(health.videoFailed + health.videoStuck, health.videoPending);
            return (
              <div className={`sh-card sh-card--${status}`}>
                <div className="sh-card-head">
                  <span className="sh-card-label">
                    <VideoIcon size={9} style={{ display: "inline", marginRight: 4 }} />
                    Video Jobs
                  </span>
                  <span className={`sh-status-dot sh-status-dot--${status}`} />
                </div>
                <div className="sh-card-metrics">
                  <div className="sh-metric">
                    <span className="sh-metric-label">Pending</span>
                    <span className={`sh-metric-val ${health.videoPending > 0 ? "sh-metric-val--warn" : "sh-metric-val--muted"}`}>{health.videoPending}</span>
                  </div>
                  <div className="sh-metric">
                    <span className="sh-metric-label">Processing</span>
                    <span className="sh-metric-val">{health.videoProcessing}</span>
                  </div>
                  <div className="sh-metric">
                    <span className="sh-metric-label">Stuck (&gt;15m)</span>
                    <span className={`sh-metric-val ${health.videoStuck > 0 ? "sh-metric-val--danger" : "sh-metric-val--muted"}`}>{health.videoStuck}</span>
                  </div>
                  <div className="sh-metric">
                    <span className="sh-metric-label">Failed</span>
                    <span className={`sh-metric-val ${health.videoFailed > 0 ? "sh-metric-val--danger" : "sh-metric-val--muted"}`}>{health.videoFailed}</span>
                  </div>
                  <div className="sh-metric">
                    <span className="sh-metric-label">Done today</span>
                    <span className={`sh-metric-val ${health.videoReadyToday > 0 ? "sh-metric-val--ok" : "sh-metric-val--muted"}`}>{health.videoReadyToday}</span>
                  </div>
                </div>
                <Link href="/admin/works" className="sh-card-action">
                  View Jobs <ArrowRight size={9} />
                </Link>
              </div>
            );
          })()}

          {/* Email Queue */}
          {(() => {
            const status = healthStatus(health.emailFailed, health.emailQueued);
            return (
              <div className={`sh-card sh-card--${status}`}>
                <div className="sh-card-head">
                  <span className="sh-card-label">
                    <Mail size={9} style={{ display: "inline", marginRight: 4 }} />
                    Email Queue
                  </span>
                  <span className={`sh-status-dot sh-status-dot--${status}`} />
                </div>
                <div className="sh-card-metrics">
                  <div className="sh-metric">
                    <span className="sh-metric-label">Queued</span>
                    <span className={`sh-metric-val ${health.emailQueued > 0 ? "sh-metric-val--warn" : "sh-metric-val--muted"}`}>{health.emailQueued}</span>
                  </div>
                  <div className="sh-metric">
                    <span className="sh-metric-label">Failed</span>
                    <span className={`sh-metric-val ${health.emailFailed > 0 ? "sh-metric-val--danger" : "sh-metric-val--muted"}`}>{health.emailFailed}</span>
                  </div>
                  <div className="sh-metric">
                    <span className="sh-metric-label">Last sent</span>
                    <span className="sh-metric-val sh-metric-val--muted">
                      {health.emailLastSentAt ? timeAgo(health.emailLastSentAt) : "—"}
                    </span>
                  </div>
                </div>
                <Link href="/admin/email" className="sh-card-action">
                  Email Center <ArrowRight size={9} />
                </Link>
              </div>
            );
          })()}

          {/* Subtitle Jobs */}
          {(() => {
            const status = healthStatus(health.subFailed, health.subPending);
            return (
              <div className={`sh-card sh-card--${status}`}>
                <div className="sh-card-head">
                  <span className="sh-card-label">Subtitle Jobs</span>
                  <span className={`sh-status-dot sh-status-dot--${status}`} />
                </div>
                <div className="sh-card-metrics">
                  <div className="sh-metric">
                    <span className="sh-metric-label">Pending</span>
                    <span className={`sh-metric-val ${health.subPending > 0 ? "sh-metric-val--warn" : "sh-metric-val--muted"}`}>{health.subPending}</span>
                  </div>
                  <div className="sh-metric">
                    <span className="sh-metric-label">Processing</span>
                    <span className="sh-metric-val">{health.subProcessing}</span>
                  </div>
                  <div className="sh-metric">
                    <span className="sh-metric-label">Failed</span>
                    <span className={`sh-metric-val ${health.subFailed > 0 ? "sh-metric-val--danger" : "sh-metric-val--muted"}`}>{health.subFailed}</span>
                  </div>
                </div>
                <Link href="/admin/works" className="sh-card-action">
                  Manage Subtitles <ArrowRight size={9} />
                </Link>
              </div>
            );
          })()}

          {/* Translation Keys */}
          {(() => {
            const status = healthStatus(health.keyInvalid, health.keyCooldown);
            return (
              <div className={`sh-card sh-card--${status}`}>
                <div className="sh-card-head">
                  <span className="sh-card-label">
                    <KeyRound size={9} style={{ display: "inline", marginRight: 4 }} />
                    Trans. Keys
                  </span>
                  <span className={`sh-status-dot sh-status-dot--${status}`} />
                </div>
                <div className="sh-card-metrics">
                  <div className="sh-metric">
                    <span className="sh-metric-label">Healthy</span>
                    <span className={`sh-metric-val ${health.keyHealthy > 0 ? "sh-metric-val--ok" : "sh-metric-val--muted"}`}>{health.keyHealthy}</span>
                  </div>
                  <div className="sh-metric">
                    <span className="sh-metric-label">Cooldown</span>
                    <span className={`sh-metric-val ${health.keyCooldown > 0 ? "sh-metric-val--warn" : "sh-metric-val--muted"}`}>{health.keyCooldown}</span>
                  </div>
                  <div className="sh-metric">
                    <span className="sh-metric-label">Invalid / Off</span>
                    <span className={`sh-metric-val ${health.keyInvalid > 0 ? "sh-metric-val--danger" : "sh-metric-val--muted"}`}>{health.keyInvalid}</span>
                  </div>
                </div>
                <Link href="/admin/translation-keys" className="sh-card-action">
                  Manage Keys <ArrowRight size={9} />
                </Link>
              </div>
            );
          })()}

          {/* Today's Pulse */}
          <div className="sh-card sh-card--healthy">
            <div className="sh-card-head">
              <span className="sh-card-label">
                <Bell size={9} style={{ display: "inline", marginRight: 4 }} />
                Today&apos;s Pulse
              </span>
              <span className="sh-status-dot sh-status-dot--healthy" />
            </div>
            <div className="sh-card-metrics">
              <div className="sh-metric">
                <span className="sh-metric-label">New users</span>
                <span className={`sh-metric-val ${health.usersToday > 0 ? "sh-metric-val--ok" : "sh-metric-val--muted"}`}>{health.usersToday}</span>
              </div>
              <div className="sh-metric">
                <span className="sh-metric-label">Subscribers</span>
                <span className={`sh-metric-val ${health.subscribersToday > 0 ? "sh-metric-val--ok" : "sh-metric-val--muted"}`}>{health.subscribersToday}</span>
              </div>
              <div className="sh-metric">
                <span className="sh-metric-label">Notify Me</span>
                <span className={`sh-metric-val ${health.notifyMeToday > 0 ? "sh-metric-val--ok" : "sh-metric-val--muted"}`}>{health.notifyMeToday}</span>
              </div>
            </div>
            <Link href="/admin/subscribers" className="sh-card-action">
              View Subscribers <ArrowRight size={9} />
            </Link>
          </div>

          {/* Security */}
          {(() => {
            const status = healthStatus(openAlerts, 0);
            return (
              <div className={`sh-card sh-card--${status}`}>
                <div className="sh-card-head">
                  <span className="sh-card-label">
                    <Shield size={9} style={{ display: "inline", marginRight: 4 }} />
                    Security
                  </span>
                  <span className={`sh-status-dot sh-status-dot--${status}`} />
                </div>
                <div className="sh-card-metrics">
                  <div className="sh-metric">
                    <span className="sh-metric-label">Open alerts</span>
                    <span className={`sh-metric-val ${openAlerts > 0 ? "sh-metric-val--danger" : "sh-metric-val--ok"}`}>{openAlerts}</span>
                  </div>
                  <div className="sh-metric">
                    <span className="sh-metric-label">Status</span>
                    <span className={`sh-metric-val ${openAlerts === 0 ? "sh-metric-val--ok" : "sh-metric-val--danger"}`}>
                      {openAlerts === 0 ? "All clear" : "Review needed"}
                    </span>
                  </div>
                </div>
                <Link href="/admin/security" className="sh-card-action">
                  Security Center <ArrowRight size={9} />
                </Link>
              </div>
            );
          })()}

        </div>
      </div>

      {/* ── Needs Attention ── */}
      {totalAttentionItems > 0 ? (
        <div className="admin-section">
          <div className="admin-section-hd">
            <h2 className="admin-section-title cmd-section-with-icon cmd-section-with-icon--danger">
              <AlertTriangle size={13} className="cmd-section-icon cmd-section-icon--danger" />
              Needs Attention
            </h2>
          </div>

          <div className="attn-panel">
            <div className="attn-panel-head">
              <p className="attn-panel-title">
                <AlertTriangle size={13} />
                Action Required
              </p>
              <span className="attn-count-badge">{totalAttentionItems}</span>
            </div>

            <div className="attn-items">
              {attention.stuckVideoCount > 0 && (
                <div className="attn-item">
                  <div className="attn-item-left">
                    <span className="attn-item-title">
                      {attention.stuckVideoCount} video job{attention.stuckVideoCount === 1 ? "" : "s"} stuck in processing
                    </span>
                    <span className="attn-item-detail">Stuck &gt; 15 min — self-heal cron will reset these automatically</span>
                  </div>
                  <span className="attn-item-badge attn-item-badge--stuck">Stuck</span>
                </div>
              )}

              {attention.failedVideoJobs.map((j) => (
                <div key={j.id} className="attn-item">
                  <div className="attn-item-left">
                    <span className="attn-item-title">
                      {j.work?.title ?? "Unknown work"} — {j.targetField}
                    </span>
                    <span className="attn-item-detail">
                      {j.errorMessage ? j.errorMessage.slice(0, 90) : "Processing failed"}
                      {j.attempts > 0 ? ` · ${j.attempts} attempt${j.attempts === 1 ? "" : "s"}` : ""}
                    </span>
                  </div>
                  <div className="attn-item-actions">
                    <Link
                      href={j.work?.id ? `/admin/works/${j.work.id}` : "/admin/works"}
                      className="attn-item-action"
                    >
                      Open Work
                    </Link>
                    <form action={dismissVideoJob}>
                      <input type="hidden" name="id" value={j.id} />
                      <button type="submit" className="attn-item-dismiss">Dismiss</button>
                    </form>
                  </div>
                </div>
              ))}

              {attention.failedSubJobs.map((j) => (
                <div key={j.id} className="attn-item">
                  <div className="attn-item-left">
                    <span className="attn-item-title">
                      Subtitle failed — {j.subtitle?.work?.title ?? "Unknown work"}
                    </span>
                    <span className="attn-item-detail">{j.error ?? "Translation job failed"}</span>
                  </div>
                  <div className="attn-item-actions">
                    <Link
                      href={j.subtitle?.work?.id ? `/admin/works/${j.subtitle.work.id}` : "/admin/works"}
                      className="attn-item-action"
                    >
                      Open Work
                    </Link>
                    <form action={dismissSubtitleJob}>
                      <input type="hidden" name="id" value={j.id} />
                      <button type="submit" className="attn-item-dismiss">Dismiss</button>
                    </form>
                  </div>
                </div>
              ))}

              {attention.badKeys.map((k) => (
                <div key={k.id} className="attn-item">
                  <div className="attn-item-left">
                    <span className="attn-item-title">Translation key — {k.name}</span>
                    <span className="attn-item-detail">
                      {k.status} · {k.errorMessage ?? "Key is disabled or invalid"}
                    </span>
                  </div>
                  <Link href="/admin/translation-keys" className="attn-item-action">
                    Manage Keys
                  </Link>
                </div>
              ))}

              {attention.openAlerts.map((a) => (
                <div key={a.id} className="attn-item">
                  <div className="attn-item-left">
                    <span className="attn-item-title">{a.title}</span>
                    <span className="attn-item-detail">
                      {a.severity} · {timeAgo(a.createdAt)}
                    </span>
                  </div>
                  <Link href="/admin/security" className="attn-item-action">Review</Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="cmd-allclear">
          <CheckCircle2 size={13} />
          All systems operational — no action required
        </div>
      )}

      {/* ── Recent Members ── */}
      <div className="admin-section">
        <div className="admin-section-hd">
          <h2 className="admin-section-title">Recent Members</h2>
          <Link href="/admin/users" className="admin-section-link">View all</Link>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((u) => (
                <tr key={u.id}>
                  <td className="td-primary">{u.name ?? "—"}</td>
                  <td className="td-muted">{u.email}</td>
                  <td>
                    <span className={`role-badge role-badge--${u.role.toLowerCase()}`}>{u.role}</span>
                  </td>
                  <td className="td-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {recentUsers.length === 0 && (
                <tr><td colSpan={4} className="table-empty">No members yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
