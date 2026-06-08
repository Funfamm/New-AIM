"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Subtitles, Plus, Trash2, Globe, Eye, EyeOff, RefreshCw } from "lucide-react";
import { SUBTITLE_TARGET_LANGS, getLangName } from "@/lib/subtitles/subtitle-languages";
import "./subtitle-panel.css";

type SubtitleRow = {
  id: string;
  workId: string;
  mediaType: string;
  sourceLanguage: string;
  label: string;
  segmentsJson: { start: number; end: number; text: string }[];
  translationsJson: Record<string, unknown[]> | null;
  vttKeysJson: Record<string, string> | null;
  isPublished: boolean;
  isDefault: boolean;
  sortOrder: number;
  jobs?: { id: string; status: string; progress: number; error: string | null; languagesJson?: string[] | null }[];
};

type SubtitleJob = {
  id: string;
  status: string;
  progress: number;
  error: string | null;
  languagesJson: string[] | null;
  updatedAt: string;
};

const LANG_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "pt", label: "Portuguese" },
  { value: "zh", label: "Chinese" },
  { value: "ar", label: "Arabic" },
  { value: "ko", label: "Korean" },
  { value: "hi", label: "Hindi" },
];

const MEDIA_OPTIONS = [
  { value: "full", label: "Full Film" },
  { value: "trailer", label: "Trailer" },
  { value: "preview", label: "Preview" },
];

type Props = { workId: string };

export default function SubtitlePanel({ workId }: Props) {
  const [subtitles, setSubtitles] = useState<SubtitleRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  // Per-subtitle job polling
  const [jobs, setJobs] = useState<Record<string, SubtitleJob | null>>({});
  const pollRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Upload form state
  const [uploading, setUploading]     = useState(false);
  const [file, setFile]               = useState<File | null>(null);
  const [sourceLang, setSourceLang]   = useState("en");
  const [mediaType, setMediaType]     = useState("full");
  const [customLabel, setCustomLabel] = useState("");

  // Confirm delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  // Poll job status for any PENDING/PROCESSING job
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

  // Resume polling for any active jobs on load
  useEffect(() => {
    subtitles.forEach((sub) => {
      const latestJob = sub.jobs?.[0];
      if (latestJob && (latestJob.status === "PENDING" || latestJob.status === "PROCESSING")) {
        setJobs((prev) => ({ ...prev, [sub.id]: latestJob as SubtitleJob }));
        startPolling(sub.id);
      }
    });
  }, [subtitles, startPolling]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("workId", workId);
      fd.append("file", file);
      fd.append("sourceLanguage", sourceLang);
      fd.append("mediaType", mediaType);
      if (customLabel.trim()) fd.append("label", customLabel.trim());

      const res = await fetch("/api/admin/subtitles", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Upload failed");
      }
      setShowUpload(false);
      setFile(null);
      setCustomLabel("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
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

  async function handleTranslate(subtitleId: string) {
    const res = await fetch(`/api/admin/subtitles/${subtitleId}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ languages: [...SUBTITLE_TARGET_LANGS] }),
    });
    if (res.ok) {
      const data = await res.json() as { job: SubtitleJob };
      setJobs((prev) => ({ ...prev, [subtitleId]: data.job }));
      startPolling(subtitleId);
    }
  }

  const translatedLangs = (sub: SubtitleRow) =>
    Object.keys(sub.vttKeysJson ?? {}).filter((k) => k !== sub.sourceLanguage);

  return (
    <section className="sp">
      <div className="sp-header">
        <h3 className="sp-title">
          <Subtitles size={16} />
          Subtitles
          <span className="sp-count">{subtitles.length}</span>
        </h3>
        <button className="sp-btn sp-btn--primary" onClick={() => setShowUpload((v) => !v)}>
          <Plus size={14} />
          Upload
        </button>
      </div>

      {error && <div className="sp-error">{error}</div>}

      {showUpload && (
        <form className="sp-upload-form" onSubmit={handleUpload}>
          <p className="sp-upload-title">Upload Subtitle File (.srt or .vtt)</p>

          <div className="sp-row">
            <div className="sp-field">
              <label className="sp-label">Media Type</label>
              <select className="sp-select" value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
                {MEDIA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
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
              <input
                type="file"
                accept=".srt,.vtt"
                className="sp-file-input"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="sp-upload-actions">
            <button type="submit" className="sp-btn sp-btn--primary" disabled={!file || uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <button type="button" className="sp-btn sp-btn--ghost" onClick={() => setShowUpload(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="sp-empty">Loading…</div>
      ) : subtitles.length === 0 ? (
        <div className="sp-empty">No subtitles yet. Upload a .srt or .vtt file to get started.</div>
      ) : (
        <div className="sp-list">
          {subtitles.map((sub) => {
            const job = jobs[sub.id] ?? sub.jobs?.[0] ?? null;
            const isActive = job?.status === "PENDING" || job?.status === "PROCESSING";
            const translated = translatedLangs(sub);

            return (
              <div key={sub.id} className="sp-item">
                <div className="sp-item-head">
                  <div className="sp-item-meta">
                    <span className="sp-item-label">{sub.label}</span>
                    <span className="sp-badge sp-badge--lang">{sub.sourceLanguage}</span>
                    <span className="sp-badge sp-badge--type">{sub.mediaType}</span>
                    <span className={`sp-badge ${sub.isPublished ? "sp-badge--pub" : "sp-badge--unpub"}`}>
                      {sub.isPublished ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="sp-item-actions">
                    <button
                      className="sp-btn sp-btn--ghost sp-btn--sm"
                      onClick={() => handlePublishToggle(sub)}
                      title={sub.isPublished ? "Unpublish" : "Publish"}
                    >
                      {sub.isPublished ? <EyeOff size={13} /> : <Eye size={13} />}
                      {sub.isPublished ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      className="sp-btn sp-btn--ghost sp-btn--sm"
                      onClick={() => handleTranslate(sub.id)}
                      disabled={isActive}
                      title="Translate to all languages via Gemini"
                    >
                      <Globe size={13} />
                      {isActive ? "Translating…" : "Translate"}
                    </button>
                    {confirmDeleteId === sub.id ? (
                      <div className="sp-confirm-row">
                        <span className="sp-confirm-text">Delete?</span>
                        <button className="sp-btn sp-btn--danger sp-btn--sm" onClick={() => handleDelete(sub.id)}>
                          Yes
                        </button>
                        <button className="sp-btn sp-btn--ghost sp-btn--sm" onClick={() => setConfirmDeleteId(null)}>
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        className="sp-btn sp-btn--ghost sp-btn--sm"
                        onClick={() => setConfirmDeleteId(sub.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="sp-item-segments">
                  {sub.segmentsJson.length} segments · uploaded source
                </div>

                {translated.length > 0 && (
                  <div className="sp-trans-grid">
                    {translated.map((lang) => (
                      <span key={lang} className="sp-trans-chip">
                        <Globe size={10} />
                        {getLangName(lang)}
                      </span>
                    ))}
                  </div>
                )}

                {job && (
                  <div className="sp-job">
                    <div className="sp-job-label">
                      <span>
                        {job.status === "READY" && "Translation complete"}
                        {job.status === "FAILED" && "Translation failed"}
                        {(job.status === "PENDING" || job.status === "PROCESSING") && (
                          <>
                            <RefreshCw size={11} className="sp-spin" style={{ display: "inline", marginRight: 4 }} />
                            Translating… {job.progress}%
                          </>
                        )}
                      </span>
                      <span>{job.languagesJson?.length ?? 0} languages</span>
                    </div>
                    {isActive && (
                      <div className="sp-progress-bar">
                        <div className="sp-progress-fill" style={{ width: `${job.progress}%` }} />
                      </div>
                    )}
                    {job.error && <div className="sp-job-error">{job.error}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
