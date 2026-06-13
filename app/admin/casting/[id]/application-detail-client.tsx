"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminUpdateApplicationStatus, adminAddNote, adminRetriggerReview } from "@/lib/actions/casting";
import type { adminGetApplication } from "@/lib/actions/casting";
import type { CastingApplicationStatus } from "@prisma/client";

type App = NonNullable<Awaited<ReturnType<typeof adminGetApplication>>>;

const DECISION_OPTS: { value: CastingApplicationStatus; label: string }[] = [
  { value: "SHORTLISTED",  label: "Shortlist" },
  { value: "CONTACTED",    label: "Mark Contacted" },
  { value: "SELECTED",     label: "Select" },
  { value: "NOT_SELECTED", label: "Not Selected" },
];

const STATUS_DISPLAY: Record<string, string> = {
  SUBMITTED:              "Received",
  UNDER_AGENT_REVIEW:     "Under Review",
  REQUIREMENTS_NOT_MET:   "Action Required",
  READY_FOR_ADMIN_REVIEW: "Ready for Review",
  SHORTLISTED:            "Shortlisted",
  CONTACTED:              "Contacted",
  SELECTED:               "Selected",
  NOT_SELECTED:           "Not Selected",
  WITHDRAWN:              "Withdrawn",
};

const STATUS_PILL: Record<string, string> = {
  SUBMITTED:              "ca-pill--neutral",
  UNDER_AGENT_REVIEW:     "ca-pill--neutral",
  REQUIREMENTS_NOT_MET:   "ca-pill--warn",
  READY_FOR_ADMIN_REVIEW: "ca-pill--info",
  SHORTLISTED:            "ca-pill--good",
  CONTACTED:              "ca-pill--good",
  SELECTED:               "ca-pill--success",
  NOT_SELECTED:           "ca-pill--muted",
  WITHDRAWN:              "ca-pill--muted",
};

export default function ApplicationDetailClient({ app }: { app: App }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [loadingMedia, setLoadingMedia] = useState<Record<string, boolean>>({});

  async function fetchMediaUrl(mediaId: string) {
    if (mediaUrls[mediaId]) return;
    setLoadingMedia((prev) => ({ ...prev, [mediaId]: true }));
    const res = await fetch(`/api/casting/media-url?mediaId=${mediaId}`);
    const data = await res.json();
    if (data.url) {
      setMediaUrls((prev) => ({ ...prev, [mediaId]: data.url }));
    }
    setLoadingMedia((prev) => ({ ...prev, [mediaId]: false }));
  }

  async function handleStatusUpdate(newStatus: CastingApplicationStatus) {
    setActionError(null);
    startTransition(async () => {
      const result = await adminUpdateApplicationStatus(app.id, newStatus);
      if (result.ok) {
        router.refresh();
      } else {
        setActionError(result.error ?? "Update failed.");
      }
    });
  }

  async function handleAddNote() {
    setNoteError(null);
    if (!note.trim()) { setNoteError("Note cannot be empty."); return; }
    startTransition(async () => {
      const result = await adminAddNote(app.id, note);
      if (result.ok) {
        setNote("");
        router.refresh();
      } else {
        setNoteError(result.error ?? "Failed to save note.");
      }
    });
  }

  async function handleRetrigger() {
    setActionError(null);
    startTransition(async () => {
      const result = await adminRetriggerReview(app.id);
      if (result.ok) {
        router.refresh();
      } else {
        setActionError(result.error ?? "Retrigger failed.");
      }
    });
  }

  const images = app.media.filter((m) => m.type === "IMAGE");
  const audio  = app.media.find((m) => m.type === "AUDIO");
  const review = app.agentReview;

  return (
    <div className="ca-detail">

      {/* Status + quick actions */}
      <div className="ca-detail-section ca-detail-actions-card">
        <div className="ca-detail-status-row">
          <span className={`ca-pill ca-pill--lg ${STATUS_PILL[app.status] ?? ""}`}>
            {STATUS_DISPLAY[app.status] ?? app.status}
          </span>
          <button
            className="ca-btn ca-btn--ghost ca-btn--sm"
            onClick={handleRetrigger}
            disabled={isPending}
            title="Delete existing review and re-run AI evaluation"
          >
            Retrigger AI Review
          </button>
        </div>

        <div className="ca-decision-row">
          {DECISION_OPTS.map((opt) => (
            <button
              key={opt.value}
              className={`ca-btn ca-btn--sm ${app.status === opt.value ? "ca-btn--primary" : "ca-btn--outline"}`}
              onClick={() => handleStatusUpdate(opt.value)}
              disabled={isPending || app.status === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {actionError && <p className="ca-field-error">{actionError}</p>}
      </div>

      {/* Applicant info */}
      <div className="ca-detail-section">
        <h2 className="ca-detail-section-title">Applicant</h2>
        <div className="ca-info-grid">
          <span className="ca-info-key">Email</span>      <span className="ca-info-val">{app.email}</span>
          <span className="ca-info-key">Location</span>   <span className="ca-info-val">{app.location}</span>
          <span className="ca-info-key">Social</span>     <span className="ca-info-val">{app.socialHandle}</span>
          {app.gender   && <><span className="ca-info-key">Gender</span>    <span className="ca-info-val">{app.gender}</span></>}
          {app.ageRange && <><span className="ca-info-key">Age Range</span> <span className="ca-info-val">{app.ageRange}</span></>}
          <span className="ca-info-key">Submitted</span>  <span className="ca-info-val">{new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short" }).format(new Date(app.createdAt))}</span>
          <span className="ca-info-key">Policy v</span>   <span className="ca-info-val">{app.policyVersion ?? "—"}</span>
          <span className="ca-info-key">IP</span>         <span className="ca-info-val ca-info-val--mono">{app.ipAddress ?? "—"}</span>
        </div>
        {app.roleInterest && (
          <div className="ca-info-text-block">
            <p className="ca-info-text-label">Why this role</p>
            <p className="ca-info-text">{app.roleInterest}</p>
          </div>
        )}
        {app.shortNote && (
          <div className="ca-info-text-block">
            <p className="ca-info-text-label">Short note</p>
            <p className="ca-info-text">{app.shortNote}</p>
          </div>
        )}
      </div>

      {/* Media */}
      <div className="ca-detail-section">
        <h2 className="ca-detail-section-title">Media ({images.length} image{images.length !== 1 ? "s" : ""}{audio ? ", 1 audio" : ""})</h2>
        <div className="ca-media-grid">
          {images.map((m) => (
            <div key={m.id} className="ca-media-thumb">
              {mediaUrls[m.id] ? (
                <a href={mediaUrls[m.id]} target="_blank" rel="noopener noreferrer">
                  <img src={mediaUrls[m.id]} alt="Casting photo" className="ca-media-img" />
                </a>
              ) : (
                <button
                  className="ca-media-load-btn"
                  onClick={() => fetchMediaUrl(m.id)}
                  disabled={loadingMedia[m.id]}
                >
                  {loadingMedia[m.id] ? "Loading…" : "View Photo"}
                </button>
              )}
            </div>
          ))}
        </div>

        {audio && (
          <div className="ca-audio-row">
            <span className="ca-audio-label">Voice Sample</span>
            {audio.durationSeconds != null && (
              <span className="ca-audio-dur">{Math.floor(audio.durationSeconds / 60)}:{String(audio.durationSeconds % 60).padStart(2, "0")}</span>
            )}
            {mediaUrls[audio.id] ? (
              <audio controls src={mediaUrls[audio.id]} className="ca-audio-player" />
            ) : (
              <button
                className="ca-btn ca-btn--ghost ca-btn--sm"
                onClick={() => fetchMediaUrl(audio.id)}
                disabled={loadingMedia[audio.id]}
              >
                {loadingMedia[audio.id] ? "Loading…" : "Load Audio"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Agent review */}
      {review ? (
        <div className="ca-detail-section">
          <h2 className="ca-detail-section-title">
            AI Agent Report
            <span className={`ca-rec ca-rec--lg ${review.recommendation === "PASS" ? "ca-rec--pass" : review.recommendation === "FAIL" ? "ca-rec--fail" : "ca-rec--manual"}`}>
              {review.recommendation.replace("_", " ")}
            </span>
          </h2>

          <div className="ca-score-bar">
            <div className="ca-score-overall">
              <span className="ca-score-number">{review.overallScore}</span>
              <span className="ca-score-denom">/100</span>
            </div>
            <div className="ca-score-breakdown">
              <div className="ca-score-item"><span>Photo</span><strong>{review.photoScore}/30</strong></div>
              <div className="ca-score-item"><span>Voice</span><strong>{review.voiceScore}/30</strong></div>
              <div className="ca-score-item"><span>Social</span><strong>{review.socialScore}/20</strong></div>
              <div className="ca-score-item"><span>Form</span><strong>{review.formScore}/20</strong></div>
            </div>
          </div>

          {review.summary && (
            <div className="ca-review-block">
              <p className="ca-review-block-label">Summary</p>
              <p className="ca-review-text">{review.summary}</p>
            </div>
          )}

          {review.imageReview && (
            <div className="ca-review-block">
              <p className="ca-review-block-label">Photo Review</p>
              <p className="ca-review-text">{review.imageReview}</p>
            </div>
          )}

          {review.audioReview && (
            <div className="ca-review-block">
              <p className="ca-review-block-label">Audio Review</p>
              <p className="ca-review-text">{review.audioReview}</p>
            </div>
          )}

          {review.socialResult && (
            <div className="ca-review-block">
              <p className="ca-review-block-label">Social</p>
              <p className="ca-review-text">{review.socialResult}</p>
            </div>
          )}

          {review.roleMatchResult && (
            <div className="ca-review-block">
              <p className="ca-review-block-label">Role Match</p>
              <p className="ca-review-text">{review.roleMatchResult}</p>
            </div>
          )}

          {review.suggestedAction && (
            <div className="ca-review-block">
              <p className="ca-review-block-label">Suggested Action</p>
              <p className="ca-review-text">{review.suggestedAction}</p>
            </div>
          )}

          {review.missingItems && review.missingItems.length > 0 && (
            <div className="ca-review-block">
              <p className="ca-review-block-label">Missing Items</p>
              <ul className="ca-missing-list">
                {review.missingItems.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          )}

          <p className="ca-review-timestamp">
            Reviewed {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(review.completedAt ?? review.createdAt))}
          </p>
        </div>
      ) : (
        <div className="ca-detail-section ca-review-pending">
          <p>No agent review yet.</p>
        </div>
      )}

      {/* Notes */}
      <div className="ca-detail-section">
        <h2 className="ca-detail-section-title">Admin Notes</h2>

        {app.notes.length === 0 ? (
          <p className="ca-notes-empty">No notes yet.</p>
        ) : (
          <div className="ca-notes-list">
            {app.notes.map((n) => (
              <div key={n.id} className="ca-note">
                <div className="ca-note-meta">
                  <span className="ca-note-author">{n.admin?.name ?? n.admin?.email ?? "Admin"}</span>
                  <span className="ca-note-date">
                    {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(n.createdAt))}
                  </span>
                </div>
                <p className="ca-note-body">{n.body}</p>
              </div>
            ))}
          </div>
        )}

        <div className="ca-note-form">
          <textarea
            className="ca-textarea"
            placeholder="Add a note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
          {noteError && <p className="ca-field-error">{noteError}</p>}
          <button
            className="ca-btn ca-btn--primary ca-btn--sm"
            onClick={handleAddNote}
            disabled={isPending}
          >
            Add Note
          </button>
        </div>
      </div>

    </div>
  );
}
