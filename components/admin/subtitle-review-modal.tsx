"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, RefreshCw } from "lucide-react";
import { SUBTITLE_TARGET_LANGS, LANGUAGE_NAMES } from "@/lib/subtitles/subtitle-languages";
import type { SubtitleCue } from "./subtitle-editor";

// ── Types ─────────────────────────────────────────────────────────────────────

type SubtitleJob = {
  id: string;
  type: string;
  status: string;
  progress: number;
  error?: string | null;
  languagesJson?: string[] | null;
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
  jobs?: SubtitleJob[];
};

type LangStatus = "available" | "pending" | "processing" | "failed" | "missing";

interface Props {
  subtitle: SubtitleRow;
  onClose: () => void;
  onTranslate: (languages: string[]) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLangStatus(lang: string, subtitle: SubtitleRow): LangStatus {
  const vttKeys = subtitle.vttKeysJson ?? {};
  if (vttKeys[lang]) return "available";

  const translations = subtitle.translationsJson ?? {};
  if (translations[lang]) return "available";

  const jobs = subtitle.jobs ?? [];
  const relevant = jobs.filter((j) => {
    const langs = (j.languagesJson as string[] | null) ?? [];
    return j.type === "translate" && langs.includes(lang);
  });

  if (!relevant.length) return "missing";

  const latest = relevant.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

  if (latest.status === "PROCESSING") return "processing";
  if (latest.status === "PENDING") return "pending";
  if (latest.status === "FAILED") return "failed";
  if (latest.status === "READY") return "available";

  return "missing";
}

function getStatusIcon(s: LangStatus): string {
  switch (s) {
    case "available": return "✓";
    case "pending": return "⏳";
    case "processing": return "⚙";
    case "failed": return "✕";
    case "missing": return "—";
  }
}

function getStatusClass(s: LangStatus): string {
  switch (s) {
    case "available": return "srm-lang--available";
    case "pending": return "srm-lang--pending";
    case "processing": return "srm-lang--processing";
    case "failed": return "srm-lang--failed";
    case "missing": return "srm-lang--missing";
  }
}

function getJobProgress(lang: string, subtitle: SubtitleRow): number | null {
  const jobs = subtitle.jobs ?? [];
  const relevant = jobs.filter((j) => {
    const langs = (j.languagesJson as string[] | null) ?? [];
    return j.type === "translate" && langs.includes(lang) &&
      (j.status === "PROCESSING" || j.status === "PENDING");
  });
  if (!relevant.length) return null;
  return relevant[0].progress;
}

function getJobError(lang: string, subtitle: SubtitleRow): string | null {
  const jobs = subtitle.jobs ?? [];
  const relevant = jobs.filter((j) => {
    const langs = (j.languagesJson as string[] | null) ?? [];
    return j.type === "translate" && langs.includes(lang) && j.status === "FAILED";
  });
  if (!relevant.length) return null;
  return relevant[0].error ?? "Unknown error";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SubtitleReviewModal({ subtitle, onClose, onTranslate }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [globalRetrying, setGlobalRetrying] = useState(false);

  const sourceSegments = subtitle.segmentsJson ?? [];
  const isApproved = subtitle.status === "approved_source";

  // Per-language statuses
  const langStatuses = Object.fromEntries(
    SUBTITLE_TARGET_LANGS.map((l) => [l, getLangStatus(l, subtitle)])
  ) as Record<string, LangStatus>;

  const availableCount = Object.values(langStatuses).filter((s) => s === "available").length;
  const failedLangs = SUBTITLE_TARGET_LANGS.filter((l) => langStatuses[l] === "failed");
  const missingLangs = SUBTITLE_TARGET_LANGS.filter((l) => langStatuses[l] === "missing");
  const pendingLangs = SUBTITLE_TARGET_LANGS.filter((l) => langStatuses[l] === "pending" || langStatuses[l] === "processing");

  function toggleLang(lang: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) next.delete(lang);
      else next.add(lang);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(SUBTITLE_TARGET_LANGS));
  }

  function selectMissing() {
    setSelected(new Set([...missingLangs, ...failedLangs]));
  }

  function clearAll() {
    setSelected(new Set());
  }

  async function retryLang(lang: string) {
    setRetrying((r) => new Set([...r, lang]));
    try {
      await fetch(`/api/admin/subtitles/${subtitle.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languages: [lang] }),
      });
    } finally {
      setRetrying((r) => { const n = new Set(r); n.delete(lang); return n; });
    }
  }

  async function retryAllFailed() {
    setGlobalRetrying(true);
    try {
      await fetch(`/api/admin/subtitles/${subtitle.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languages: failedLangs }),
      });
    } finally {
      setGlobalRetrying(false);
    }
  }

  function handleTranslate() {
    if (!selected.size) return;
    onTranslate([...selected]);
    onClose();
  }

  return createPortal(
    <div className="srm-overlay">
      <div className="srm-modal">
        {/* Header */}
        <div className="srm-header">
          <div className="srm-header-left">
            <span className="srm-title">Subtitles &amp; Translation</span>
            <span className={`srm-status-badge ${isApproved ? "srm-badge--approved" : "srm-badge--draft"}`}>
              {isApproved ? "✓ Approved Source" : "Draft"}
            </span>
          </div>
          <button className="srm-close" onClick={onClose}><X size={15} /></button>
        </div>

        {/* Source summary */}
        <div className="srm-source">
          <div className="srm-source-grid">
            <div className="srm-source-cell">
              <div className="srm-cell-label">Source Language</div>
              <div className="srm-cell-val">{LANGUAGE_NAMES[subtitle.sourceLanguage] ?? subtitle.sourceLanguage}</div>
            </div>
            <div className="srm-source-cell">
              <div className="srm-cell-label">Segments</div>
              <div className="srm-cell-val">{sourceSegments.length}</div>
            </div>
            <div className="srm-source-cell">
              <div className="srm-cell-label">Translations</div>
              <div className="srm-cell-val">{availableCount} / {SUBTITLE_TARGET_LANGS.length}</div>
            </div>
            <div className="srm-source-cell">
              <div className="srm-cell-label">Media</div>
              <div className="srm-cell-val">{subtitle.mediaType}</div>
            </div>
          </div>

          {!isApproved && (
            <div className="srm-warn-banner">
              ⚠ Source subtitles are in draft. Approve them in the editor before translating.
            </div>
          )}
        </div>

        {/* Language grid */}
        <div className="srm-grid-section">
          <div className="srm-grid-header">
            <span className="srm-grid-title">Language Status</span>
            <div className="srm-grid-actions">
              {failedLangs.length > 0 && (
                <button className="srm-action-btn srm-action-btn--retry" onClick={retryAllFailed} disabled={globalRetrying}>
                  <RefreshCw size={10} /> {globalRetrying ? "Retrying…" : `Retry ${failedLangs.length} failed`}
                </button>
              )}
            </div>
          </div>

          <div className="srm-lang-grid">
            {/* English source row */}
            <div className="srm-lang-row srm-lang-row--source">
              <div className="srm-lang-name">
                <span className="srm-lang-flag">🇬🇧</span>
                English (source)
              </div>
              <div className="srm-lang-status srm-lang--available">
                <span className="srm-status-icon">✓</span>
                <span className="srm-status-label">{sourceSegments.length} segs</span>
              </div>
              <div className="srm-lang-actions" />
            </div>

            {SUBTITLE_TARGET_LANGS.map((lang) => {
              const st = langStatuses[lang];
              const progress = getJobProgress(lang, subtitle);
              const err = getJobError(lang, subtitle);
              const isRetrying = retrying.has(lang);
              const isSelected = selected.has(lang);

              return (
                <div
                  key={lang}
                  className={`srm-lang-row ${isSelected ? "srm-lang-row--selected" : ""}`}
                  onClick={() => isApproved && toggleLang(lang)}
                  style={{ cursor: isApproved ? "pointer" : "default" }}
                >
                  <div className="srm-lang-name">
                    <input
                      type="checkbox"
                      className="srm-lang-check"
                      checked={isSelected}
                      disabled={!isApproved}
                      onChange={() => toggleLang(lang)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="srm-lang-code">{lang.toUpperCase()}</span>
                    <span className="srm-lang-label">{LANGUAGE_NAMES[lang]}</span>
                  </div>

                  <div className={`srm-lang-status ${getStatusClass(st)}`}>
                    <span className="srm-status-icon">{getStatusIcon(st)}</span>
                    <span className="srm-status-label">
                      {st === "processing" && progress !== null ? `${progress}%` : st}
                    </span>
                    {st === "processing" && progress !== null && (
                      <div className="srm-progress-bar">
                        <div className="srm-progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>

                  <div className="srm-lang-actions">
                    {st === "failed" && (
                      <>
                        {err && <span className="srm-err-msg" title={err}>!</span>}
                        <button
                          className="srm-retry-btn"
                          disabled={isRetrying}
                          onClick={(e) => { e.stopPropagation(); retryLang(lang); }}
                        >
                          <RefreshCw size={10} /> {isRetrying ? "…" : "Retry"}
                        </button>
                      </>
                    )}
                    {st === "available" && (
                      <span className="srm-vtt-link">VTT ✓</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selection bar + translate action */}
        {isApproved && (
          <div className="srm-footer">
            <div className="srm-selection-summary">
              {selected.size > 0
                ? `${selected.size} language${selected.size !== 1 ? "s" : ""} selected`
                : "No languages selected"}
            </div>
            <div className="srm-footer-actions">
              <button className="srm-action-btn" onClick={selectMissing} disabled={missingLangs.length === 0 && failedLangs.length === 0}>
                Select missing
              </button>
              <button className="srm-action-btn" onClick={selectAll}>Select all</button>
              <button className="srm-action-btn" onClick={clearAll}>Clear</button>
              <button
                className="srm-translate-btn"
                onClick={handleTranslate}
                disabled={selected.size === 0 || pendingLangs.length > 0}
                title={pendingLangs.length > 0 ? "Wait for in-progress translations to finish" : ""}
              >
                Translate {selected.size > 0 ? `(${selected.size})` : ""}
              </button>
            </div>
          </div>
        )}

        {!isApproved && (
          <div className="srm-footer srm-footer--blocked">
            <span className="srm-blocked-msg">
              Approve source subtitles in the editor to enable translation.
            </span>
          </div>
        )}
      </div>

      <style>{`
        .srm-overlay {
          position: fixed; inset: 0; z-index: 9050;
          background: rgba(0,0,0,0.75);
          display: flex; align-items: center; justify-content: center;
        }
        .srm-modal {
          background: #111; border: 1px solid #222; border-radius: 12px;
          width: 560px; max-width: 95vw; max-height: 88vh;
          display: flex; flex-direction: column;
          box-shadow: 0 24px 80px rgba(0,0,0,0.7);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 13px; color: #d0d0d0;
          overflow: hidden;
        }
        .srm-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 18px; border-bottom: 1px solid #1e1e1e;
          flex-shrink: 0;
        }
        .srm-header-left { display: flex; align-items: center; gap: 10px; }
        .srm-title { font-size: 15px; font-weight: 700; color: #fff; }
        .srm-status-badge {
          font-size: 11px; font-weight: 600;
          padding: 2px 9px; border-radius: 99px;
        }
        .srm-badge--draft {
          background: rgba(255,200,0,0.1); color: #ffc800;
          border: 1px solid rgba(255,200,0,0.2);
        }
        .srm-badge--approved {
          background: rgba(0,200,100,0.1); color: #00c864;
          border: 1px solid rgba(0,200,100,0.2);
        }
        .srm-close {
          background: none; border: none; color: #666; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          padding: 4px; border-radius: 4px;
        }
        .srm-close:hover { color: #ef4444; background: rgba(239,68,68,0.1); }
        .srm-source {
          padding: 12px 18px; border-bottom: 1px solid #1e1e1e;
          flex-shrink: 0;
        }
        .srm-source-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
        }
        .srm-source-cell { display: flex; flex-direction: column; gap: 2px; }
        .srm-cell-label {
          font-size: 9.5px; text-transform: uppercase;
          letter-spacing: 0.05em; color: #555;
        }
        .srm-cell-val { font-size: 13px; font-weight: 600; color: #ccc; }
        .srm-warn-banner {
          margin-top: 10px; padding: 7px 10px;
          background: rgba(245,158,11,0.08);
          border: 1px solid rgba(245,158,11,0.2);
          border-radius: 5px;
          font-size: 11px; color: #f59e0b;
        }
        .srm-grid-section {
          flex: 1; overflow-y: auto; padding: 0;
          min-height: 0;
        }
        .srm-grid-section::-webkit-scrollbar { width: 5px; }
        .srm-grid-section::-webkit-scrollbar-track { background: transparent; }
        .srm-grid-section::-webkit-scrollbar-thumb { background: #222; border-radius: 99px; }
        .srm-grid-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 18px 6px;
          position: sticky; top: 0; background: #111; z-index: 1;
        }
        .srm-grid-title {
          font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.05em; color: #555;
        }
        .srm-grid-actions { display: flex; gap: 6px; }
        .srm-lang-grid { padding: 0 10px 8px; }
        .srm-lang-row {
          display: grid;
          grid-template-columns: 1fr auto auto;
          align-items: center;
          gap: 10px;
          padding: 7px 8px;
          border-radius: 6px;
          border: 1px solid transparent;
          margin-bottom: 2px;
          transition: background 0.08s, border-color 0.08s;
        }
        .srm-lang-row:hover { background: rgba(255,255,255,0.025); }
        .srm-lang-row--selected {
          background: rgba(59,130,246,0.07);
          border-color: rgba(59,130,246,0.25);
        }
        .srm-lang-row--source {
          background: rgba(0,200,100,0.04);
          border-color: rgba(0,200,100,0.1);
          margin-bottom: 8px;
        }
        .srm-lang-name {
          display: flex; align-items: center; gap: 6px;
          min-width: 0;
        }
        .srm-lang-check { accent-color: #3b82f6; flex-shrink: 0; }
        .srm-lang-flag { font-size: 14px; }
        .srm-lang-code {
          font-size: 11px; font-weight: 700; color: #888;
          font-family: monospace;
        }
        .srm-lang-label { font-size: 12px; color: #bbb; }
        .srm-lang-status {
          display: flex; align-items: center; gap: 5px;
          font-size: 11px; white-space: nowrap;
        }
        .srm-lang--available { color: #00c864; }
        .srm-lang--pending { color: #f59e0b; }
        .srm-lang--processing { color: #3b82f6; }
        .srm-lang--failed { color: #ef4444; }
        .srm-lang--missing { color: #444; }
        .srm-status-icon { font-size: 10px; font-weight: 700; }
        .srm-status-label { font-size: 10px; text-transform: capitalize; }
        .srm-progress-bar {
          width: 50px; height: 3px;
          background: rgba(59,130,246,0.2); border-radius: 99px;
        }
        .srm-progress-fill {
          height: 100%; background: #3b82f6;
          border-radius: 99px; transition: width 0.3s;
        }
        .srm-lang-actions {
          display: flex; align-items: center; gap: 4px;
          min-width: 70px; justify-content: flex-end;
        }
        .srm-err-msg {
          font-size: 11px; color: #ef4444; font-weight: 700; cursor: help;
        }
        .srm-retry-btn {
          display: inline-flex; align-items: center; gap: 3px;
          background: rgba(245,158,11,0.12);
          border: 1px solid rgba(245,158,11,0.25);
          color: #f59e0b; font-size: 10px; font-weight: 600;
          padding: 3px 7px; border-radius: 4px; cursor: pointer;
        }
        .srm-retry-btn:hover:not(:disabled) { background: rgba(245,158,11,0.22); }
        .srm-retry-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .srm-vtt-link { font-size: 9px; color: #444; }
        .srm-action-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid #222; color: #999;
          font-size: 10px; padding: 4px 9px; border-radius: 4px;
          cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
          white-space: nowrap;
        }
        .srm-action-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: #ddd; }
        .srm-action-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .srm-action-btn--retry {
          background: rgba(245,158,11,0.08);
          border-color: rgba(245,158,11,0.2); color: #f59e0b;
        }
        .srm-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 18px; border-top: 1px solid #1e1e1e;
          flex-shrink: 0; gap: 10px;
        }
        .srm-footer--blocked { justify-content: center; }
        .srm-blocked-msg { font-size: 12px; color: #555; font-style: italic; }
        .srm-selection-summary { font-size: 12px; color: #666; }
        .srm-footer-actions { display: flex; align-items: center; gap: 5px; }
        .srm-translate-btn {
          background: rgba(99,102,241,0.75);
          border: none; color: #fff;
          font-size: 12px; font-weight: 700;
          padding: 6px 16px; border-radius: 6px; cursor: pointer;
          white-space: nowrap;
        }
        .srm-translate-btn:hover:not(:disabled) { background: rgb(99,102,241); }
        .srm-translate-btn:disabled { opacity: 0.35; cursor: not-allowed; }
      `}</style>
    </div>,
    document.body
  );
}
