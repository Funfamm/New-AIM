"use client";

// Compose tab — Group D:
//  - Channel selector: Both / In-app only / Email only (default Both when ACS ready)
//  - Image URL field with live thumbnail preview; auto-suggested from work posterUrl
//  - CTA paired validation (label + URL — both required or both empty)
//  - Live preview panel: in-app notification card + email channel hint
//  - Release / Episode now call sendReleaseOutreach / sendEpisodeOutreach (imageUrl support)

import { useTransition, useState } from "react";
import {
  sendAnnouncement,
  sendReleaseOutreach,
  sendEpisodeOutreach,
} from "@/lib/actions/outreach";
import type { OutreachResult, AudienceType } from "@/lib/actions/outreach";

type PublishedWork    = { id: string; title: string; type: string; posterUrl?: string | null };
type PublishedEpisode = {
  id:            string;
  title:         string;
  episodeNumber: number | null;
  seasonNumber:  number | null;
  seriesTitle:   string | null;
  posterUrl?:    string | null;
};

type Props = {
  acsReady:         boolean;
  acsConfigured:    boolean;
  bulkEmailEnabled: boolean;
  publishedWorks:    PublishedWork[];
  publishedEpisodes: PublishedEpisode[];
};

type ComposeType = "announcement" | "release" | "episode" | "studio";
type ChannelType = "both" | "inapp" | "email";

const TYPES: { id: ComposeType; label: string; available: boolean }[] = [
  { id: "announcement", label: "Announcement",  available: true  },
  { id: "release",      label: "New Release",   available: true  },
  { id: "episode",      label: "New Episode",   available: true  },
  { id: "studio",       label: "Studio Update", available: false },
];

const AUDIENCE_OPTIONS: { id: AudienceType; label: string; hint: string }[] = [
  { id: "all",        label: "All users",        hint: "All active registered users" },
  { id: "admins",     label: "Admins only",       hint: "Admin accounts only" },
  { id: "notify_me",  label: "Notify Me signups", hint: "Email addresses from Notify Me CTAs" },
  { id: "saved_work", label: "Saved work users",  hint: "Users who saved at least one work" },
];

const CHANNELS: { id: ChannelType; label: string }[] = [
  { id: "both",  label: "Both" },
  { id: "inapp", label: "In-app only" },
  { id: "email", label: "Email only" },
];

function isValidUrl(url: string): boolean {
  if (!url.trim()) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch { return false; }
}

function formatResult(r: OutreachResult): string {
  const parts: string[] = [];
  if ((r.created    ?? 0) > 0) parts.push(`${r.created} in-app`);
  if ((r.queued     ?? 0) > 0) parts.push(`${r.queued} email${r.queued === 1 ? "" : "s"} queued`);
  if ((r.suppressed ?? 0) > 0) parts.push(`${r.suppressed} suppressed`);
  if ((r.skipped    ?? 0) > 0) parts.push(`${r.skipped} skipped`);
  return `✓ Sent${parts.length ? ` — ${parts.join(" · ")}` : ""}`;
}

export default function OutreachComposeForm({
  acsReady,
  acsConfigured,
  bulkEmailEnabled,
  publishedWorks,
  publishedEpisodes,
}: Props) {
  // ── Core state ──────────────────────────────────────────────
  const [composeType, setComposeType] = useState<ComposeType>("announcement");
  const [audience,    setAudience]    = useState<AudienceType>("all");
  const [channel,     setChannel]     = useState<ChannelType>(acsReady ? "both" : "inapp");

  // Announcement controlled fields (for live preview)
  const [annTitle, setAnnTitle] = useState("");
  const [annBody,  setAnnBody]  = useState("");

  // Shared: work selection + email image
  const [selectedWorkId, setSelectedWorkId] = useState("");
  const [imageUrl,       setImageUrl]       = useState("");

  // CTA (announcement only — controlled for paired validation)
  const [ctaUrl,   setCtaUrl]   = useState("");
  const [ctaLabel, setCtaLabel] = useState("");

  const [pending, startTransition] = useTransition();
  const [result,  setResult]       = useState<OutreachResult | null>(null);
  const [formKey, setFormKey]      = useState(0);

  // ── Derived ─────────────────────────────────────────────────
  const ctaError =
    (ctaUrl   && !ctaLabel) ? "CTA label is required when a URL is provided." :
    (ctaLabel && !ctaUrl)   ? "CTA URL is required when a label is provided." :
    null;

  const imgValid = isValidUrl(imageUrl);

  const emailDisabledReason: string | null =
    !acsConfigured    ? "ACS not configured" :
    !bulkEmailEnabled ? "Disabled in Admin Settings" :
    null;

  const emailChannelDisabled = emailDisabledReason !== null;

  // Preview data
  const selectedWork    = publishedWorks.find((w) => w.id === selectedWorkId);
  const selectedEpisode = publishedEpisodes.find((e) => e.id === selectedWorkId);

  const previewTitle =
    composeType === "announcement" ? (annTitle  || "Notification title preview") :
    composeType === "release"      ? (selectedWork?.title    || "New Release") :
    composeType === "episode"      ? (selectedEpisode?.title || "New Episode") :
    "Notification title preview";

  const previewBody =
    composeType === "announcement" ? (annBody || "Your notification message will appear here.") :
    composeType === "release"      ? "A new film has just dropped — watch it now." :
    composeType === "episode"      ? "A new episode is now available. Watch it now." :
    "";

  const previewIcon =
    composeType === "release" ? "🎬" :
    composeType === "episode" ? "🎞️" :
    "📣";

  const previewTypeLabel =
    composeType === "release" ? "New Release" :
    composeType === "episode" ? "New Episode" :
    "Announcement";

  // Show email preview when channel includes email (or for release/episode which are email-only)
  const showEmailPreview =
    composeType === "release" || composeType === "episode" ||
    (channel === "both" || channel === "email");

  // ── Handlers ─────────────────────────────────────────────────
  function resetState() {
    setFormKey((k) => k + 1);
    setAudience("all");
    setChannel(acsReady ? "both" : "inapp");
    setAnnTitle("");
    setAnnBody("");
    setSelectedWorkId("");
    setImageUrl("");
    setCtaUrl("");
    setCtaLabel("");
  }

  function handleTypeChange(t: ComposeType) {
    if (!TYPES.find((x) => x.id === t)?.available) return;
    setComposeType(t);
    setResult(null);
    setSelectedWorkId("");
    setImageUrl("");
    setCtaUrl("");
    setCtaLabel("");
    setAnnTitle("");
    setAnnBody("");
  }

  function handleWorkChange(workId: string) {
    setSelectedWorkId(workId);
    // Auto-populate imageUrl from the work's posterUrl
    if (composeType === "release") {
      const work = publishedWorks.find((w) => w.id === workId);
      setImageUrl(work?.posterUrl ?? "");
    } else if (composeType === "episode") {
      const ep = publishedEpisodes.find((e) => e.id === workId);
      setImageUrl(ep?.posterUrl ?? "");
    }
  }

  function handleChannelChange(ch: ChannelType) {
    if (emailChannelDisabled && (ch === "both" || ch === "email")) return;
    if (ch === "inapp") setImageUrl(""); // clear image when switching to in-app only
    setChannel(ch);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ctaError) return;

    const formData = new FormData(e.currentTarget);
    setResult(null);

    startTransition(async () => {
      let r: OutreachResult;

      if (composeType === "announcement") {
        r = await sendAnnouncement(formData);
      } else if (composeType === "release") {
        if (!selectedWorkId) { setResult({ error: "Select a published work." }); return; }
        r = await sendReleaseOutreach(selectedWorkId, imageUrl || null);
      } else if (composeType === "episode") {
        if (!selectedWorkId) { setResult({ error: "Select a published episode." }); return; }
        r = await sendEpisodeOutreach(selectedWorkId, imageUrl || null);
      } else {
        r = { error: "This message type is coming in a future phase." };
      }

      setResult(r);
      if (!r.error) resetState();
    });
  }

  // ── Shared: image URL field ──────────────────────────────────
  // Visible input drives imageUrl state; hidden input in announcement form
  // carries the value into formData.
  const imageField = (
    <div className="outreach-field outreach-field--full">
      <label className="outreach-label" htmlFor="oc-image-url">
        Email image URL{" "}
        <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
          (optional — https://…)
        </span>
      </label>
      <div className="outreach-img-input-row">
        <input
          id="oc-image-url"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          className="outreach-input"
          autoComplete="off"
        />
        {imageUrl && (
          <button
            type="button"
            onClick={() => setImageUrl("")}
            className="outreach-img-clear"
            aria-label="Clear image URL"
          >
            ✕
          </button>
        )}
      </div>
      {imgValid && (
        <div className="outreach-img-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Email banner preview"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
    </div>
  );

  // ── Shared: preview panel ────────────────────────────────────
  const previewPanel = (
    <div className="outreach-preview">
      <p className="outreach-label" style={{ marginBottom: "0.75rem" }}>Preview</p>

      {/* In-app notification mock */}
      <div className="outreach-preview-inapp">
        <div className="outreach-preview-inapp-head">
          <span className="outreach-preview-icon" aria-hidden="true">{previewIcon}</span>
          <div>
            <p className="outreach-preview-type">{previewTypeLabel}</p>
            <p className="outreach-preview-title">{previewTitle}</p>
          </div>
        </div>
        {previewBody && (
          <p className="outreach-preview-body">{previewBody}</p>
        )}
        {composeType === "announcement" && ctaLabel && isValidUrl(ctaUrl) && (
          <span className="outreach-preview-cta">{ctaLabel}</span>
        )}
      </div>

      {/* Email channel hint */}
      {showEmailPreview && !emailChannelDisabled && (
        <div className="outreach-preview-email">
          <p className="outreach-preview-email-label">Email (ACS bulk)</p>
          <p className="outreach-preview-email-detail">
            Subject: {previewTitle}
          </p>
          {imgValid && (
            <p className="outreach-preview-email-detail">🖼 Image banner included</p>
          )}
        </div>
      )}
      {showEmailPreview && emailChannelDisabled && (
        <div className="outreach-preview-email outreach-preview-email--warn">
          <p className="outreach-preview-email-label">Email</p>
          <p className="outreach-preview-email-detail">⚠ {emailDisabledReason}</p>
        </div>
      )}
    </div>
  );

  // ── Channel selector (announcement only) ─────────────────────
  const channelSelector = (
    <div>
      <p className="outreach-label" style={{ marginBottom: "0.6rem" }}>Delivery Channel</p>
      <div className="outreach-channel-grid">
        {CHANNELS.map((ch) => {
          const isEmailCh  = ch.id === "email" || ch.id === "both";
          const isDisabled = isEmailCh && emailChannelDisabled;
          return (
            <button
              key={ch.id}
              type="button"
              disabled={isDisabled}
              onClick={() => handleChannelChange(ch.id)}
              title={isDisabled ? (emailDisabledReason ?? undefined) : undefined}
              className={[
                "outreach-channel-btn",
                channel === ch.id   ? "outreach-channel-btn--active"   : "",
                isDisabled          ? "outreach-channel-btn--disabled"  : "",
              ].join(" ").trim()}
              aria-pressed={channel === ch.id}
            >
              {ch.label}
            </button>
          );
        })}
      </div>
      {emailChannelDisabled && (
        <p className="outreach-hint" style={{ marginTop: "0.4rem" }}>
          ⚠ Email channel unavailable — {emailDisabledReason}.
          {!acsConfigured && " Configure ACS to unlock bulk email."}
          {acsConfigured && !bulkEmailEnabled && (
            <> Enable it in <a href="/admin/settings" style={{ color: "var(--color-brand-accent)" }}>Admin Settings</a>.</>
          )}
        </p>
      )}
    </div>
  );

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="outreach-section">
      <h2 className="outreach-section-title">Compose</h2>

      {/* ── Message type selector ──────────────────────────────── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <p className="outreach-label" style={{ marginBottom: "0.6rem" }}>Message Type</p>
        <div className="outreach-type-grid">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={!t.available}
              onClick={() => handleTypeChange(t.id)}
              className={[
                "outreach-type-btn",
                composeType === t.id ? "outreach-type-btn--active"   : "",
                !t.available         ? "outreach-type-btn--disabled" : "",
              ].join(" ").trim()}
              title={!t.available ? "Coming soon" : undefined}
              aria-pressed={composeType === t.id}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ Announcement form ═══════════════════════════════════ */}
      {composeType === "announcement" && (
        <form key={formKey} onSubmit={handleSubmit} className="outreach-form">
          {/* Hidden fields carry state into FormData */}
          <input type="hidden" name="audienceType" value={audience} />
          <input type="hidden" name="channel"      value={channel}  />
          <input type="hidden" name="imageUrl"      value={imageUrl} />

          {/* Audience */}
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

          {/* Title */}
          <div className="outreach-field">
            <label className="outreach-label" htmlFor="oc-title">Title *</label>
            <input
              id="oc-title"
              name="title"
              type="text"
              required
              maxLength={120}
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="e.g. New film dropping this week"
              className="outreach-input"
            />
          </div>

          {/* Body */}
          <div className="outreach-field">
            <label className="outreach-label" htmlFor="oc-body">Message *</label>
            <textarea
              id="oc-body"
              name="body"
              required
              maxLength={500}
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              placeholder="Announcement text shown to users…"
              className="outreach-textarea"
            />
          </div>

          {/* CTA */}
          <div className="outreach-form-row">
            <div className="outreach-field">
              <label className="outreach-label" htmlFor="oc-href">CTA URL (optional)</label>
              <input
                id="oc-href"
                name="href"
                type="url"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://…"
                className="outreach-input"
              />
            </div>
            <div className="outreach-field">
              <label className="outreach-label" htmlFor="oc-href-label">CTA label (optional)</label>
              <input
                id="oc-href-label"
                name="hrefLabel"
                type="text"
                maxLength={40}
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="e.g. Watch Now"
                className="outreach-input"
              />
            </div>
          </div>
          {ctaError && <p className="outreach-error">{ctaError}</p>}

          {/* Expiry */}
          <div className="outreach-field" style={{ maxWidth: "300px" }}>
            <label className="outreach-label" htmlFor="oc-expires">Expires at (optional)</label>
            <input
              id="oc-expires"
              name="expiresAt"
              type="datetime-local"
              className="outreach-input"
            />
          </div>

          {/* Channel selector */}
          {channelSelector}

          {/* Image URL — only shown when email channel is active */}
          {(channel === "both" || channel === "email") && !emailChannelDisabled && imageField}

          {/* Live preview */}
          {previewPanel}

          {/* Feedback */}
          {result?.error && <p className="outreach-error">⚠ {result.error}</p>}
          {result && !result.error && (
            <p className="outreach-ok">{formatResult(result)}</p>
          )}

          <button
            type="submit"
            disabled={pending || !!ctaError}
            className="outreach-submit-btn"
          >
            {pending ? "Sending…" : "Send Now"}
          </button>
        </form>
      )}

      {/* ══ New Release form ════════════════════════════════════ */}
      {composeType === "release" && (
        <form key={`release-${formKey}`} onSubmit={handleSubmit} className="outreach-form">
          {!acsReady && (
            <p className="outreach-warn">
              ⚠ {!acsConfigured
                ? "Bulk email provider (ACS) is not configured."
                : "Bulk email sending is disabled in Admin Settings."
              }{" "}Email will not be queued.
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
                onChange={(e) => handleWorkChange(e.target.value)}
                required
              >
                <option value="">— Select a work —</option>
                {publishedWorks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title} ({w.type.replace(/_/g, " ").toLowerCase()})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Image URL with auto-populated poster */}
          {imageField}

          <p className="outreach-hint">
            Queues a bulk email to all opted-in users announcing this release.
            Selecting a work auto-fills the image URL with its poster if available.
            Uses the same re-send guard as the quick-action on the work edit page.
          </p>

          {/* Preview — shown once a work is selected */}
          {selectedWorkId && previewPanel}

          {result?.error && <p className="outreach-error">⚠ {result.error}</p>}
          {result && !result.error && (
            <p className="outreach-ok">{formatResult(result)}</p>
          )}

          <button
            type="submit"
            disabled={pending || !selectedWorkId}
            className="outreach-submit-btn"
          >
            {pending ? "Queuing…" : "Queue Release Email"}
          </button>
        </form>
      )}

      {/* ══ New Episode form ════════════════════════════════════ */}
      {composeType === "episode" && (
        <form key={`episode-${formKey}`} onSubmit={handleSubmit} className="outreach-form">
          {!acsReady && (
            <p className="outreach-warn">
              ⚠ {!acsConfigured
                ? "Bulk email provider (ACS) is not configured."
                : "Bulk email sending is disabled in Admin Settings."
              }{" "}Email will not be queued.
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
                onChange={(e) => handleWorkChange(e.target.value)}
                required
              >
                <option value="">— Select an episode —</option>
                {publishedEpisodes.map((ep) => {
                  const epLabel =
                    ep.seasonNumber && ep.episodeNumber ? `S${ep.seasonNumber}E${ep.episodeNumber}` :
                    ep.episodeNumber ? `Ep ${ep.episodeNumber}` : "";
                  return (
                    <option key={ep.id} value={ep.id}>
                      {ep.seriesTitle ? `${ep.seriesTitle} — ` : ""}{ep.title}{epLabel ? ` (${epLabel})` : ""}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Image URL with auto-populated poster */}
          {imageField}

          <p className="outreach-hint">
            Queues a bulk email to opted-in users announcing this episode.
            Selecting an episode auto-fills the image URL with its poster if available.
          </p>

          {/* Preview — shown once an episode is selected */}
          {selectedWorkId && previewPanel}

          {result?.error && <p className="outreach-error">⚠ {result.error}</p>}
          {result && !result.error && (
            <p className="outreach-ok">{formatResult(result)}</p>
          )}

          <button
            type="submit"
            disabled={pending || !selectedWorkId}
            className="outreach-submit-btn"
          >
            {pending ? "Queuing…" : "Queue Episode Email"}
          </button>
        </form>
      )}
    </div>
  );
}
