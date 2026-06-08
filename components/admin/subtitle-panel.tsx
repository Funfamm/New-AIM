"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Subtitles, Plus, Trash2, Globe, Eye, EyeOff, RefreshCw,
  Video, Edit3, CheckCircle, Film,
} from "lucide-react";
import { SUBTITLE_TARGET_LANGS, getLangName } from "@/lib/subtitles/subtitle-languages";
import dynamic from "next/dynamic";
import "./subtitle-panel.css";

const SubtitleEditor = dynamic(() => import("./subtitle-editor"), { ssr: false });
const SubtitleReviewModal = dynamic(() => import("./subtitle-review-modal"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

export type SubtitleCue = { start: number; end: number; text: string };

type SubtitleJob = {
  id: string;
  type: string;
  status: string;
  progress: number;
  error: string | null;
  languagesJson: string[] | null;
  createdAt: string;
  updatedAt: string;
};

type SubtitleRow = {
  id: string;
  workId: string;
  mediaType: string;
  sourceLanguage: string;
  label: string;
  status: string;
  segmentsJson: SubtitleCue[];
  translationsJson: Record<string, SubtitleCue[]> | null;
  vttKeysJson: Record<string, string> | null;
  isPublished: boolean;
  isDefault: boolean;
  sortOrder: number;
  jobs?: SubtitleJob[];
};

type MediaTab = "full" | "trailer";

// ── Constants ─────────────────────────────────────────────────────────────────

const LANG_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
  { value: "zh", label: "Chinese" },
  { value: "ar", label: "Arabic" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "hi", label: "Hindi" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  workId: string;
  videoUrl?: string | null;
  trailerUrl?: string | null;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SubtitlePanel({ workId, videoUrl, trailerUrl }: Props) {
  const [activeTab, setActiveTab] = useState<MediaTab>("full");
  const [subtitles, setSubtitles] = useState<SubtitleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Job polling
  const [jobs, setJobs] = useState<Record<string, SubtitleJob | null>>({});
  const pollRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Upload form
  const [showUpload, setShowUpload] = useState<MediaTab | null>(null);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState("en");
  const [customLabel, setCustomLabel] = useState("");

  // Generating (transcription)
  const [generating, setGenerating] = useState<Record<MediaTab, boolean>>({ full: false, trailer: false });

  // Confirm delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Editor modal
  const [editorSubtitle, setEditorSubtitle] = useState<SubtitleRow | null>(null);

  // Review modal
  const [reviewSubtitle, setReviewSubtitle] = useState<SubtitleRow | null>(null);

  // Approving
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/subtitles?workId=${workId}`);
      if (!res.ok) throw new Error("Failed to load subtitles");
      const data = await res.json() as { subtitles: SubtitleRow[] };
      setSubtitles(data.subtitles);
    } catch {
      setError("Could not load subtitles.");
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => { load(); }, [load]);

  // ── Job polling ───────────────────────────────────────────────────────────
  const startPolling = useCallback((subtitleId: string) => {
    if (pollRef.current[subtitleId]) return;
    pollRef.current[subtitleId] = setInterval(async () => {
      const res = await fetch(`/api/admin/subtitles/${subtitleId}/job`);
      if (!res.ok) return;
      const data = await res.json() as { job: SubtitleJob | null };
      setJobs((prev) => ({ ...prev, [subtitleId]: data.job }));
      if (!data.job || data.job.status === "READY" || data.job.status === "FAILED") {
        clearInterval(pollRef.current[subtitleId]);
        delete pollRef.current[subtitleId];
        if (data.job?.status === "READY") load();
      }
    }, 3000);
  }, [load]);

  useEffect(() => () => {
    Object.values(pollRef.current).forEach(clearInterval);
  }, []);

  useEffect(() => {
    subtitles.forEach((sub) => {
      const latestJob = sub.jobs?.[0];
      if (latestJob && (latestJob.status === "PENDING" || latestJob.status === "PROCESSING")) {
        setJobs((prev) => ({ ...prev, [sub.id]: latestJob }));
        startPolling(sub.id);
      }
    });
  }, [subtitles, startPolling]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentSub = subtitles.find((s) => s.mediaType === activeTab) ?? null;
  const currentJob = currentSub ? (jobs[currentSub.id] ?? currentSub.jobs?.[0] ?? null) : null;
  const hasJobActive = currentJob?.status === "PENDING" || currentJob?.status === "PROCESSING";
  const currentVideoUrl = activeTab === "full" ? (videoUrl ?? null) : (trailerUrl ?? null);
  const hasVideo = !!currentVideoUrl;

  const translatedLangs = currentSub ? Object.keys(currentSub.vttKeysJson ?? {}) : [];

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleGenerate(mt: MediaTab) {
    setGenerating((prev) => ({ ...prev, [mt]: true }));
    setError(null);
    try {
      const res = await fetch("/api/admin/subtitles/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workId, mediaType: mt }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Generate failed");
      }
      const data = await res.json() as { subtitleId: string; jobId: string };
      await load();
      setJobs((prev) => ({ ...prev, [data.subtitleId]: null }));
      startPolling(data.subtitleId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating((prev) => ({ ...prev, [mt]: false }));
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !showUpload) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("workId", workId);
      fd.append("file", file);
      fd.append("sourceLanguage", sourceLang);
      fd.append("mediaType", showUpload);
      if (customLabel.trim()) fd.append("label", customLabel.trim());
      const res = await fetch("/api/admin/subtitles", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Upload failed");
      }
      setShowUpload(null);
      setFile(null);
      setCustomLabel("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleApprove(sub: SubtitleRow) {
    if (!confirm("Approve these source subtitles? This enables translation to all languages.")) return;
    setApprovingId(sub.id);
    try {
      const res = await fetch(`/api/admin/subtitles/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved_source" }),
      });
      if (res.ok) await load();
    } finally {
      setApprovingId(null);
    }
  }

  async function handleTranslate(subtitleId: string, languages: string[]) {
    const res = await fetch(`/api/admin/subtitles/${subtitleId}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ languages }),
    });
    if (res.ok) {
      const data = await res.json() as { job: SubtitleJob };
      setJobs((prev) => ({ ...prev, [subtitleId]: data.job }));
      startPolling(subtitleId);
      await load();
    }
  }

  async function handlePublishToggle(sub: SubtitleRow) {
    const res = await fetch(`/api/admin/subtitles/${sub.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !sub.isPublished }),
    });
    if (res.ok) await load();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/subtitles/${id}`, { method: "DELETE" });
    if (res.ok) { setConfirmDeleteId(null); await load(); }
  }

  function handleEditorSaved(newStatus: string, newSegments: SubtitleCue[]) {
    setSubtitles((prev) =>
      prev.map((s) =>
        s.id === editorSubtitle?.id
          ? { ...s, status: newStatus, segmentsJson: newSegments }
          : s
      )
    );
  }

  // ── Job bar text ──────────────────────────────────────────────────────────
  function jobBarText(job: SubtitleJob): string {
    const type = job.type === "transcribe" ? "Transcribing" : "Translating";
    if (job.status === "PENDING") return `${type}… (queued)`;
    if (job.status === "PROCESSING") return `${type}… ${job.progress}%`;
    if (job.status === "READY") return `${type} complete`;
    if (job.status === "FAILED") return `${type} failed`;
    return job.status;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const isApproved = currentSub?.status === "approved_source";

  return (
    <section className="sp">
      {/* ══ Section header ════════════════════════════════════════════════ */}
      <div className="sp-header">
        <h3 className="sp-title">
          <Subtitles size={16} />
          Subtitles
          <span className="sp-count">{subtitles.length}</span>
        </h3>
        <div className="sp-header-actions">
          <button
            className="sp-btn sp-btn--ghost sp-btn--sm"
            onClick={load}
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {error && <div className="sp-error">{error}<button className="sp-error-dismiss" onClick={() => setError(null)}>✕</button></div>}

      {/* ══ Media tabs ════════════════════════════════════════════════════ */}
      <div className="sp-tabs">
        <button
          className={`sp-tab ${activeTab === "full" ? "sp-tab--active" : ""}`}
          onClick={() => { setActiveTab("full"); setShowUpload(null); }}
        >
          <Film size={12} />
          Full Film
          {subtitles.find((s) => s.mediaType === "full") && (
            <span className="sp-tab-dot" />
          )}
        </button>
        <button
          className={`sp-tab ${activeTab === "trailer" ? "sp-tab--active" : ""}`}
          onClick={() => { setActiveTab("trailer"); setShowUpload(null); }}
        >
          <Video size={12} />
          Trailer
          {subtitles.find((s) => s.mediaType === "trailer") && (
            <span className="sp-tab-dot" />
          )}
        </button>
      </div>

      {/* ══ Tab content ═══════════════════════════════════════════════════ */}
      <div className="sp-tab-content">
        {loading ? (
          <div className="sp-empty">Loading…</div>
        ) : (
          <>
            {/* ── Action buttons row ─────────────────────────────────── */}
            <div className="sp-actions-row">
              {/* Generate via AI transcription */}
              <button
                className="sp-btn sp-btn--generate"
                onClick={() => handleGenerate(activeTab)}
                disabled={!hasVideo || hasJobActive || generating[activeTab]}
                title={!hasVideo ? `No ${activeTab === "full" ? "video" : "trailer"} URL set on this work` : "Generate subtitles via AI transcription"}
              >
                <RefreshCw size={13} className={generating[activeTab] ? "sp-spin" : ""} />
                {generating[activeTab] ? "Generating…" : "Generate"}
              </button>

              {/* Upload SRT/VTT */}
              <button
                className={`sp-btn ${showUpload === activeTab ? "sp-btn--primary" : "sp-btn--ghost"} sp-btn--sm`}
                onClick={() => setShowUpload(showUpload === activeTab ? null : activeTab)}
              >
                <Plus size={13} />
                Upload SRT
              </button>

              {currentSub && (
                <>
                  {/* Edit in editor */}
                  <button
                    className="sp-btn sp-btn--ghost sp-btn--sm"
                    onClick={() => setEditorSubtitle(currentSub)}
                    disabled={hasJobActive}
                    title="Open subtitle editor"
                  >
                    <Edit3 size={13} />
                    Edit
                  </button>

                  {/* Approve source */}
                  {!isApproved && currentSub.segmentsJson.length > 0 && (
                    <button
                      className="sp-btn sp-btn--approve sp-btn--sm"
                      onClick={() => handleApprove(currentSub)}
                      disabled={approvingId === currentSub.id || hasJobActive}
                      title="Approve source subtitles (enables translation)"
                    >
                      <CheckCircle size={13} />
                      {approvingId === currentSub.id ? "Approving…" : "Approve"}
                    </button>
                  )}

                  {/* Review / Translate */}
                  <button
                    className="sp-btn sp-btn--ghost sp-btn--sm"
                    onClick={() => setReviewSubtitle(currentSub)}
                    title="Review translations and manage language status"
                  >
                    <Globe size={13} />
                    {translatedLangs.length > 0 ? `Translations (${translatedLangs.length})` : "Translate"}
                  </button>

                  <div className="sp-actions-spacer" />

                  {/* Publish toggle */}
                  <button
                    className={`sp-btn sp-btn--sm ${currentSub.isPublished ? "sp-btn--ghost" : "sp-btn--ghost"}`}
                    onClick={() => handlePublishToggle(currentSub)}
                    title={currentSub.isPublished ? "Unpublish subtitles" : "Publish subtitles"}
                  >
                    {currentSub.isPublished ? <EyeOff size={13} /> : <Eye size={13} />}
                    {currentSub.isPublished ? "Unpublish" : "Publish"}
                  </button>

                  {/* Delete */}
                  {confirmDeleteId === currentSub.id ? (
                    <div className="sp-confirm-row">
                      <span className="sp-confirm-text">Delete this subtitle record?</span>
                      <button className="sp-btn sp-btn--danger sp-btn--sm" onClick={() => handleDelete(currentSub.id)}>Yes</button>
                      <button className="sp-btn sp-btn--ghost sp-btn--sm" onClick={() => setConfirmDeleteId(null)}>No</button>
                    </div>
                  ) : (
                    <button
                      className="sp-btn sp-btn--ghost sp-btn--sm"
                      onClick={() => setConfirmDeleteId(currentSub.id)}
                      title="Delete subtitle record"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* ── Upload form ─────────────────────────────────────────── */}
            {showUpload === activeTab && (
              <form className="sp-upload-form" onSubmit={handleUpload}>
                <p className="sp-upload-title">Upload Subtitle File (.srt or .vtt) — {activeTab === "full" ? "Full Film" : "Trailer"}</p>
                <div className="sp-row">
                  <div className="sp-field">
                    <label className="sp-label">Source Language</label>
                    <select className="sp-select" value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
                      {LANG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="sp-field">
                    <label className="sp-label">Label (optional)</label>
                    <input
                      className="sp-input"
                      placeholder="e.g. English (SDH)"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                    />
                  </div>
                </div>
                <div className="sp-row">
                  <label className={`sp-file-label${file ? " has-file" : ""}`}>
                    <Plus size={14} />
                    {file ? file.name : "Choose .srt or .vtt file"}
                    <input type="file" accept=".srt,.vtt" className="sp-file-input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
                <div className="sp-upload-actions">
                  <button type="submit" className="sp-btn sp-btn--primary" disabled={!file || uploading}>
                    {uploading ? "Uploading…" : "Upload"}
                  </button>
                  <button type="button" className="sp-btn sp-btn--ghost" onClick={() => { setShowUpload(null); setFile(null); }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* ── Subtitle card ────────────────────────────────────────── */}
            {currentSub ? (
              <div className="sp-item">
                {/* Status bar */}
                <div className="sp-item-head">
                  <div className="sp-item-meta">
                    <span className="sp-item-label">{currentSub.label}</span>
                    <span className="sp-badge sp-badge--lang">{currentSub.sourceLanguage.toUpperCase()}</span>
                    <span className={`sp-badge ${currentSub.isPublished ? "sp-badge--pub" : "sp-badge--unpub"}`}>
                      {currentSub.isPublished ? "Published" : "Unpublished"}
                    </span>
                    <span className={`sp-badge ${isApproved ? "sp-badge--approved" : "sp-badge--draft"}`}>
                      {isApproved ? "✓ Approved" : "Draft"}
                    </span>
                  </div>
                </div>

                {/* Segment count */}
                <div className="sp-item-segments">
                  {currentSub.segmentsJson.length} segments
                  {" · "}
                  {isApproved ? "ready for translation" : "approve to enable translation"}
                </div>

                {/* Translations summary */}
                {translatedLangs.length > 0 && (
                  <div className="sp-trans-grid">
                    {translatedLangs.map((lang) => (
                      <span key={lang} className="sp-trans-chip">
                        <Globe size={10} />
                        {getLangName(lang)}
                      </span>
                    ))}
                    {SUBTITLE_TARGET_LANGS.filter((l) => !translatedLangs.includes(l)).length > 0 && (
                      <span className="sp-trans-chip sp-trans-chip--missing">
                        +{SUBTITLE_TARGET_LANGS.filter((l) => !translatedLangs.includes(l)).length} pending
                      </span>
                    )}
                  </div>
                )}

                {/* Job progress bar */}
                {currentJob && (currentJob.status === "PENDING" || currentJob.status === "PROCESSING" || currentJob.status === "FAILED" || currentJob.status === "READY") && (
                  <div className={`sp-job ${currentJob.status === "FAILED" ? "sp-job--failed" : ""}`}>
                    <div className="sp-job-label">
                      <span>
                        {hasJobActive && <RefreshCw size={11} className="sp-spin" style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />}
                        {jobBarText(currentJob)}
                      </span>
                      {currentJob.languagesJson?.length ? (
                        <span>{currentJob.languagesJson.length} lang{currentJob.languagesJson.length !== 1 ? "s" : ""}</span>
                      ) : null}
                    </div>
                    {hasJobActive && (
                      <div className="sp-progress-bar">
                        <div className="sp-progress-fill" style={{ width: `${currentJob.progress}%` }} />
                      </div>
                    )}
                    {currentJob.error && <div className="sp-job-error">{currentJob.error}</div>}
                  </div>
                )}
              </div>
            ) : (
              <div className="sp-empty">
                <p>No subtitles for {activeTab === "full" ? "Full Film" : "Trailer"} yet.</p>
                {hasVideo ? (
                  <div className="sp-empty-actions">
                    <button className="sp-btn sp-btn--generate" onClick={() => handleGenerate(activeTab)} disabled={generating[activeTab]}>
                      <RefreshCw size={13} className={generating[activeTab] ? "sp-spin" : ""} />
                      {generating[activeTab] ? "Starting…" : "Generate via AI"}
                    </button>
                    <span className="sp-empty-or">or</span>
                    <button className="sp-btn sp-btn--ghost sp-btn--sm" onClick={() => setShowUpload(activeTab)}>
                      <Plus size={13} /> Upload SRT
                    </button>
                  </div>
                ) : (
                  <p className="sp-empty-hint">
                    Upload a {activeTab === "full" ? "video" : "trailer"} to enable AI transcription.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ══ Subtitle Editor modal ══════════════════════════════════════════ */}
      {editorSubtitle && (
        <SubtitleEditor
          subtitleId={editorSubtitle.id}
          workId={workId}
          videoUrl={currentVideoUrl}
          mediaType={editorSubtitle.mediaType}
          initialSegments={editorSubtitle.segmentsJson}
          currentStatus={editorSubtitle.status}
          onClose={() => { setEditorSubtitle(null); load(); }}
          onSaved={(newStatus, newSegments) => handleEditorSaved(newStatus, newSegments)}
        />
      )}

      {/* ══ Review modal ══════════════════════════════════════════════════ */}
      {reviewSubtitle && (
        <SubtitleReviewModal
          subtitle={reviewSubtitle}
          onClose={() => { setReviewSubtitle(null); load(); }}
          onTranslate={(langs) => handleTranslate(reviewSubtitle.id, langs)}
        />
      )}
    </section>
  );
}
