"use client";

// Compose tab — Phase 4: Announcement + in-app send.
// Phase 5: email channel enabled.
// Phase 7: New Release, New Episode types added.

import { useTransition, useState } from "react";
import { sendAnnouncement } from "@/lib/actions/outreach";
import { sendNewReleaseEmail, sendNewEpisodeEmail } from "@/lib/actions/release-email";
import type { OutreachResult, AudienceType } from "@/lib/actions/outreach";
import type { ReleaseEmailResult } from "@/lib/actions/release-email";

type PublishedWork    = { id: string; title: string; type: string };
type PublishedEpisode = {
  id:            string;
  title:         string;
  episodeNumber: number | null;
  seasonNumber:  number | null;
  seriesTitle:   string | null;
};

type Props = {
  acsReady:         boolean;
  acsConfigured:    boolean;
  bulkEmailEnabled: boolean;
  publishedWorks:    PublishedWork[];
  publishedEpisodes: PublishedEpisode[];
};

type ComposeType = "announcement" | "release" | "episode" | "studio";

const TYPES: { id: ComposeType; label: string; available: boolean }[] = [
  { id: "announcement", label: "Announcement", available: true },
  { id: "release",      label: "New Release",  available: true },
  { id: "episode",      label: "New Episode",  available: true },
  { id: "studio",       label: "Studio Update", available: false },
];

const AUDIENCE_OPTIONS: { id: AudienceType; label: string; hint: string }[] = [
  { id: "all",        label: "All users",          hint: "All active registered users" },
  { id: "admins",     label: "Admins only",         hint: "Admin accounts only" },
  { id: "notify_me",  label: "Notify Me signups",   hint: "Email addresses from Notify Me CTAs" },
  { id: "saved_work", label: "Saved work users",    hint: "Users who saved at least one work" },
];

const INITIAL: OutreachResult = {};

export default function OutreachComposeForm({
  acsReady,
  acsConfigured,
  bulkEmailEnabled,
  publishedWorks,
  publishedEpisodes,
}: Props) {
  const [composeType, setComposeType] = useState<ComposeType>("announcement");
  const [audience, setAudience]       = useState<AudienceType>("all");
  const [sendEmail, setSendEmail]     = useState(false);
  const [selectedWorkId, setSelectedWorkId] = useState("");
  const [pending, startTransition]    = useTransition();
  const [result, setResult]           = useState<OutreachResult | ReleaseEmailResult | null>(null);
  const [formKey, setFormKey]         = useState(0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setResult(null);

    startTransition(async () => {
      let r: OutreachResult | ReleaseEmailResult = INITIAL;

      if (composeType === "announcement") {
        r = await sendAnnouncement(formData);
      } else if (composeType === "release") {
        if (!selectedWorkId) { setResult({ error: "Select a published work." }); return; }
        r = await sendNewReleaseEmail(selectedWorkId);
      } else if (composeType === "episode") {
        if (!selectedWorkId) { setResult({ error: "Select a published episode." }); return; }
        r = await sendNewEpisodeEmail(selectedWorkId);
      } else {
        r = { error: "This message type is coming in a future phase." };
      }

      setResult(r);
      if (!r.error) {
        setFormKey((k) => k + 1);
        setSendEmail(false);
        setAudience("all");
        setSelectedWorkId("");
      }
    });
  }

  return (
    <div className="outreach-section">
      <h2 className="outreach-section-title">Compose</h2>

      {/* ── Message type selector ───────────────── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <p className="outreach-label" style={{ marginBottom: "0.6rem" }}>Message Type</p>
        <div className="outreach-type-grid">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={!t.available}
              onClick={() => { if (t.available) { setComposeType(t.id); setResult(null); } }}
              className={`outreach-type-btn${composeType === t.id ? " outreach-type-btn--active" : ""}${!t.available ? " outreach-type-btn--disabled" : ""}`}
              title={!t.available ? "Coming soon" : undefined}
              aria-pressed={composeType === t.id}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Announcement form ────────────────────── */}
      {composeType === "announcement" && (
        <form key={formKey} onSubmit={handleSubmit} className="outreach-form">
          <input type="hidden" name="audienceType" value={audience} />

          {/* ── Audience selector ──────────────── */}
          <div>
            <p className="outreach-label" style={{ marginBottom: "0.6rem" }}>Audience</p>
            <div className="outreach-audience-grid">
              {AUDIENCE_OPTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAudience(a.id)}
                  className={`outreach-audience-btn${audience === a.id ? " outreach-audience-btn--active" : ""}`}
                  title={a.hint}
                  aria-pressed={audience === a.id}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="outreach-field">
            <label className="outreach-label" htmlFor="oc-title">Title *</label>
            <input
              id="oc-title"
              name="title"
              type="text"
              required
              maxLength={120}
              placeholder="e.g. New film dropping this week"
              className="outreach-input"
            />
          </div>

          <div className="outreach-field">
            <label className="outreach-label" htmlFor="oc-body">Message *</label>
            <textarea
              id="oc-body"
              name="body"
              required
              maxLength={500}
              placeholder="Announcement text shown to users…"
              className="outreach-textarea"
            />
          </div>

          <div className="outreach-form-row">
            <div className="outreach-field">
              <label className="outreach-label" htmlFor="oc-href">Link URL (optional)</label>
              <input
                id="oc-href"
                name="href"
                type="url"
                placeholder="https://…"
                className="outreach-input"
              />
            </div>
            <div className="outreach-field">
              <label className="outreach-label" htmlFor="oc-href-label">Link label (optional)</label>
              <input
                id="oc-href-label"
                name="hrefLabel"
                type="text"
                maxLength={40}
                placeholder="e.g. Watch Now"
                className="outreach-input"
              />
            </div>
          </div>

          <div className="outreach-field" style={{ maxWidth: "300px" }}>
            <label className="outreach-label" htmlFor="oc-expires">Expires at (optional)</label>
            <input
              id="oc-expires"
              name="expiresAt"
              type="datetime-local"
              className="outreach-input"
            />
          </div>

          {/* ── Delivery channels ──────────────── */}
          <div>
            <p className="outreach-label" style={{ marginBottom: "0.6rem" }}>Delivery Channels</p>
            <div className="outreach-channels">
              <label className="outreach-channel-row" style={{ cursor: "default" }}>
                <input type="checkbox" checked readOnly style={{ cursor: "default" }} />
                In-app notification
              </label>

              <label className="outreach-channel-row">
                <input
                  type="checkbox"
                  name="sendEmail"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  disabled={!acsReady}
                />
                Bulk email (ACS)
                {!acsConfigured && (
                  <span style={{ fontSize: "0.72rem", color: "#f59e0b", marginLeft: "0.35rem" }}>
                    — ACS not configured
                  </span>
                )}
                {acsConfigured && !bulkEmailEnabled && (
                  <span style={{ fontSize: "0.72rem", color: "#f59e0b", marginLeft: "0.35rem" }}>
                    — disabled in{" "}
                    <a href="/admin/settings" style={{ color: "#f59e0b" }}>Admin Settings</a>
                  </span>
                )}
              </label>
            </div>
          </div>

          {/* ── Feedback ───────────────────────── */}
          {result?.error && (
            <p className="outreach-error">⚠ {result.error}</p>
          )}

          {result && !result.error && (
            <p className="outreach-ok">
              {(() => {
                const r = result as OutreachResult;
                const parts: string[] = [];
                if ((r.created ?? 0) > 0)    parts.push(`${r.created} in-app`);
                if ((r.queued ?? 0) > 0)     parts.push(`${r.queued} email${r.queued === 1 ? "" : "s"} queued`);
                if ((r.suppressed ?? 0) > 0) parts.push(`${r.suppressed} suppressed`);
                return `✓ Sent${parts.length ? ` — ${parts.join(" · ")}` : ""}`;
              })()}
            </p>
          )}

          <button type="submit" disabled={pending} className="outreach-submit-btn">
            {pending ? "Sending…" : "Send Now"}
          </button>
        </form>
      )}

      {/* ── New Release form ─────────────────────── */}
      {composeType === "release" && (
        <form key={`release-${formKey}`} onSubmit={handleSubmit} className="outreach-form">
          {!acsReady && (
            <p className="outreach-warn">
              ⚠ Email will be queued only if ACS is configured and bulk email is enabled in Admin Settings.
              In-app notifications are not created by this flow — it is email-only.
            </p>
          )}

          <div className="outreach-field">
            <label className="outreach-label" htmlFor="oc-release-work">Published Work *</label>
            {publishedWorks.length === 0 ? (
              <p style={{ fontSize: "0.82rem", color: "var(--color-brand-muted)" }}>
                No published works found.
              </p>
            ) : (
              <select
                id="oc-release-work"
                className="outreach-select"
                value={selectedWorkId}
                onChange={(e) => setSelectedWorkId(e.target.value)}
                required
              >
                <option value="">— Select a work —</option>
                {publishedWorks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title} ({w.type.replace("_", " ").toLowerCase()})
                  </option>
                ))}
              </select>
            )}
          </div>

          <p className="outreach-hint">
            Queues a bulk email to all opted-in users announcing this release.
            Uses the same sending flow as the quick-action on the work edit page.
          </p>

          {result?.error && <p className="outreach-error">⚠ {result.error}</p>}
          {result && !result.error && (
            <p className="outreach-ok">
              ✓ {(result as ReleaseEmailResult).queued ?? 0} email{(result as ReleaseEmailResult).queued === 1 ? "" : "s"} queued
              {((result as ReleaseEmailResult).suppressed ?? 0) > 0 && ` · ${(result as ReleaseEmailResult).suppressed} suppressed`}
            </p>
          )}

          <button type="submit" disabled={pending || !selectedWorkId} className="outreach-submit-btn">
            {pending ? "Queuing…" : "Queue Release Email"}
          </button>
        </form>
      )}

      {/* ── New Episode form ─────────────────────── */}
      {composeType === "episode" && (
        <form key={`episode-${formKey}`} onSubmit={handleSubmit} className="outreach-form">
          {!acsReady && (
            <p className="outreach-warn">
              ⚠ Email will be queued only if ACS is configured and bulk email is enabled in Admin Settings.
            </p>
          )}

          <div className="outreach-field">
            <label className="outreach-label" htmlFor="oc-episode-work">Published Episode *</label>
            {publishedEpisodes.length === 0 ? (
              <p style={{ fontSize: "0.82rem", color: "var(--color-brand-muted)" }}>
                No published episodes found.
              </p>
            ) : (
              <select
                id="oc-episode-work"
                className="outreach-select"
                value={selectedWorkId}
                onChange={(e) => setSelectedWorkId(e.target.value)}
                required
              >
                <option value="">— Select an episode —</option>
                {publishedEpisodes.map((ep) => {
                  const epLabel = ep.seasonNumber && ep.episodeNumber
                    ? `S${ep.seasonNumber}E${ep.episodeNumber}`
                    : ep.episodeNumber
                      ? `Ep ${ep.episodeNumber}`
                      : "";
                  return (
                    <option key={ep.id} value={ep.id}>
                      {ep.seriesTitle ? `${ep.seriesTitle} — ` : ""}{ep.title}{epLabel ? ` (${epLabel})` : ""}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          <p className="outreach-hint">
            Queues a bulk email to opted-in users announcing this episode.
            Uses the same sending flow as the quick-action on the episode edit page.
          </p>

          {result?.error && <p className="outreach-error">⚠ {result.error}</p>}
          {result && !result.error && (
            <p className="outreach-ok">
              ✓ {(result as ReleaseEmailResult).queued ?? 0} email{(result as ReleaseEmailResult).queued === 1 ? "" : "s"} queued
              {((result as ReleaseEmailResult).suppressed ?? 0) > 0 && ` · ${(result as ReleaseEmailResult).suppressed} suppressed`}
            </p>
          )}

          <button type="submit" disabled={pending || !selectedWorkId} className="outreach-submit-btn">
            {pending ? "Queuing…" : "Queue Episode Email"}
          </button>
        </form>
      )}
    </div>
  );
}
