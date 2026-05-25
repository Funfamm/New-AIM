"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

/* ── Types ── */

type SessionEvent = {
  id: string;
  type: string;
  path: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string; // ISO
};

type Session = {
  id: string;
  visitorId: string;
  userId: string | null;
  country: string | null;
  city: string | null;
  deviceType: string;
  browser: string | null;
  os: string | null;
  landingPage: string | null;
  referrer: string | null;
  startedAt: string;  // ISO
  lastSeenAt: string; // ISO
  events: SessionEvent[];
};

type RawEvent = {
  id: string;
  type: string;
  path: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string; // ISO
  session: {
    id: string;
    visitorId: string;
    userId: string | null;
    deviceType: string;
    country: string | null;
    city: string | null;
  } | null;
};

type UserInfo = { id: string; name: string | null; email: string };

type Props = {
  sessions: Session[];
  rawEvents: RawEvent[];
  userMap: Record<string, UserInfo>;
  onlineCount: number;
  onlineMembers: number;
  onlineGuests: number;
};

/* ── Helpers ── */

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const EVENT_LABELS: Record<string, string> = {
  PAGE_VIEW:          "Page View",
  WORK_VIEW:          "Work View",
  TRAILER_CLICK:      "Trailer Click",
  WATCH_START:        "Watch Start",
  WATCH_PROGRESS:     "Watch Progress",
  WATCH_COMPLETE:     "Watch Complete",
  EPISODE_START:      "Episode Start",
  EPISODE_COMPLETE:   "Episode Complete",
  SIGN_IN:            "Sign In",
  SIGN_UP:            "Sign Up",
  SIGN_OUT:           "Sign Out",
  SAVE_WORK:          "Saved Work",
  UNSAVE_WORK:        "Unsaved Work",
  NOTIFICATION_OPEN:  "Notification",
  SETTINGS_UPDATE:    "Settings Update",
  CTA_IMPRESSION:     "CTA Impression",
  CTA_SIGNUP:         "CTA Signup",
};

const DEVICE_ICONS: Record<string, string> = {
  MOBILE: "📱", TABLET: "📟", DESKTOP: "🖥", BOT: "🤖", UNKNOWN: "?",
};

/* ── Component ── */

export default function ViFeed({
  sessions,
  rawEvents,
  userMap,
  onlineCount,
  onlineMembers,
  onlineGuests,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"grouped" | "all">("grouped");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="vi-wrap">

      {/* ── Header card ── */}
      <div className="vi-header">
        <div className="vi-header-left">
          <h2 className="vi-header-title">Live Visitor Intelligence</h2>
          <div className="vi-pills">
            <span className="vi-pill vi-pill--online">
              <span className="vi-dot vi-dot--pulse" />
              {onlineCount} Online
            </span>
            <span className="vi-pill vi-pill--members">
              {onlineMembers} Members
            </span>
            <span className="vi-pill vi-pill--guests">
              {onlineGuests} Guests
            </span>
          </div>
        </div>
        <button
          className="vi-refresh-btn"
          onClick={handleRefresh}
          disabled={isPending}
          aria-label="Refresh visitor data"
        >
          <RefreshCw size={13} className={isPending ? "vi-spin" : undefined} />
          {isPending ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* ── Mode toggle ── */}
      <div className="vi-mode-bar">
        <button
          className={`vi-mode-btn${mode === "grouped" ? " vi-mode-btn--active" : ""}`}
          onClick={() => setMode("grouped")}
        >
          Grouped Sessions
        </button>
        <button
          className={`vi-mode-btn${mode === "all" ? " vi-mode-btn--active" : ""}`}
          onClick={() => setMode("all")}
        >
          All Events
        </button>
        <span className="vi-mode-hint">
          {mode === "grouped"
            ? `${sessions.length} sessions · click to expand journey`
            : `${rawEvents.length} events · most recent first`}
        </span>
      </div>

      {/* ── Grouped Sessions ── */}
      {mode === "grouped" && (
        <div className="vi-sessions">
          {sessions.length === 0 ? (
            <p className="vi-empty">No session data yet.</p>
          ) : (
            sessions.map((s) => {
              const user   = s.userId ? userMap[s.userId] ?? null : null;
              const isOpen = expanded.has(s.id);

              return (
                <div key={s.id} className={`vi-session${isOpen ? " vi-session--open" : ""}`}>
                  <button
                    className="vi-session-row"
                    onClick={() => toggleExpand(s.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="vi-session-expand">
                      {isOpen
                        ? <ChevronDown size={12} />
                        : <ChevronRight size={12} />}
                    </span>

                    <span className="vi-session-device" aria-hidden="true">
                      {DEVICE_ICONS[s.deviceType] ?? "?"}
                    </span>

                    <span className="vi-session-identity">
                      {user ? (
                        <>
                          <span className="vi-session-name">{user.name ?? user.email}</span>
                          <span className="vi-session-email">{user.email}</span>
                        </>
                      ) : (
                        <>
                          <span className="vi-session-name vi-session-name--guest">Guest</span>
                          <span className="vi-session-email">{s.visitorId.slice(0, 8)}…</span>
                        </>
                      )}
                    </span>

                    <span className="vi-session-geo">
                      {[s.city, s.country].filter(Boolean).join(", ") || "—"}
                    </span>

                    <span className="vi-session-browser">
                      {[s.browser, s.os].filter(Boolean).join(" / ") || "—"}
                    </span>

                    <span className="vi-session-time">{timeAgo(s.lastSeenAt)}</span>

                    <span className="vi-session-count">{s.events.length} ev</span>

                    <span className={`vi-auth-tag${s.userId ? " vi-auth-tag--member" : ""}`}>
                      {s.userId ? "Member" : "Guest"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="vi-journey">
                      {s.events.length === 0 ? (
                        <p className="vi-journey-empty">No events recorded for this session.</p>
                      ) : (
                        s.events.map((e, i) => (
                          <div key={e.id} className="vi-event-row">
                            <span className="vi-event-idx">{i + 1}</span>
                            <span className="vi-event-type">
                              {EVENT_LABELS[e.type] ?? e.type}
                            </span>
                            <span className="vi-event-path">{e.path ?? "—"}</span>
                            <span className="vi-event-time">{timeAgo(e.createdAt)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── All Events feed ── */}
      {mode === "all" && (
        <div className="vi-all-events">
          {rawEvents.length === 0 ? (
            <p className="vi-empty">No events yet.</p>
          ) : (
            rawEvents.map((e) => {
              const userId = e.session?.userId ?? null;
              const user   = userId ? userMap[userId] ?? null : null;
              const geo    = e.session
                ? [e.session.city, e.session.country].filter(Boolean).join(", ") || "—"
                : "—";

              return (
                <div key={e.id} className="vi-feed-row">
                  <span className="vi-feed-type">
                    {EVENT_LABELS[e.type] ?? e.type}
                  </span>
                  <span className="vi-feed-path">{e.path ?? "—"}</span>
                  <span className="vi-feed-who">
                    {user
                      ? (user.name ?? user.email)
                      : `Guest ${e.session?.visitorId?.slice(0, 6) ?? "?"}`}
                  </span>
                  <span className="vi-feed-device" aria-hidden="true">
                    {e.session ? (DEVICE_ICONS[e.session.deviceType] ?? "?") : "?"}
                  </span>
                  <span className="vi-feed-geo">{geo}</span>
                  <span className="vi-feed-time">{timeAgo(e.createdAt)}</span>
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
}
