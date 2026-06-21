"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { startVideoProcessingJob } from "@/lib/actions/video-processing";

export type PanelJob = {
  id: string;
  status: string;
  progress: number;
  hlsUrl: string | null;
  errorMessage: string | null;
};

type Props = {
  workId: string | null;
  targetField: "videoUrl" | "trailerUrl" | "previewClipUrl";
  buttonLabel: string;
  readyMessage: string;
  masterKey: string;
  initialJob: PanelJob | null;
  onUrlReady: (url: string) => void;
};

const ACTIVE = new Set(["PENDING", "PROCESSING"]);
const POLL_MS = 5000;

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING:    { bg: "rgba(99,102,241,0.15)",  color: "#818cf8" },
  PROCESSING: { bg: "rgba(234,179,8,0.15)",   color: "#eab308" },
  READY:      { bg: "rgba(34,197,94,0.15)",   color: "#22c55e" },
  FAILED:     { bg: "rgba(239,68,68,0.15)",   color: "#ef4444" },
  CANCELLED:  { bg: "rgba(107,114,128,0.15)", color: "#9ca3af" },
};

function getStatusMessage(status: string, readyMessage: string, errorMessage: string | null): string {
  switch (status) {
    case "PENDING":    return "Waiting for video processor.";
    case "PROCESSING": return "Converting video for streaming...";
    case "READY":      return readyMessage;
    case "CANCELLED":  return "Job was cancelled.";
    case "FAILED":     return errorMessage ?? "Processing failed. Re-upload master to retry.";
    default:           return "";
  }
}

export default function ProcessingPanel({
  workId,
  targetField,
  buttonLabel,
  readyMessage,
  masterKey,
  initialJob,
  onUrlReady,
}: Props) {
  const [job, setJob] = useState<PanelJob | null>(initialJob);
  const [isPending, startTransition] = useTransition();
  const [startError, setStartError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobIdRef = useRef<string | null>(initialJob?.id ?? null);
  const calledReadyRef = useRef(false);
  const prevMasterKeyRef = useRef(masterKey);

  // When admin uploads a new master file, clear stale job state so the panel resets
  useEffect(() => {
    if (masterKey === prevMasterKeyRef.current) return;
    prevMasterKeyRef.current = masterKey;
    stopPoll();
    setJob(null);
    setStartError(null);
    calledReadyRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterKey]);

  // Keep jobIdRef current so the interval always polls the right job
  useEffect(() => { jobIdRef.current = job?.id ?? null; }, [job?.id]);

  // Reset calledReady when job changes
  useEffect(() => { calledReadyRef.current = false; }, [job?.id]);

  function stopPoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  useEffect(() => () => stopPoll(), []);

  // Start/stop polling based on job activity
  useEffect(() => {
    if (!job?.id || !ACTIVE.has(job.status)) { stopPoll(); return; }

    function poll() {
      const id = jobIdRef.current;
      if (!id) return;
      fetch(`/api/admin/video-processing/${id}`, { cache: "no-store" })
        .then(r => r.ok ? (r.json() as Promise<PanelJob>) : Promise.reject())
        .then(data => {
          setJob(data);
          if (data.status === "READY" && data.hlsUrl && !calledReadyRef.current) {
            calledReadyRef.current = true;
            onUrlReady(data.hlsUrl);
          }
          if (!ACTIVE.has(data.status)) stopPoll();
        })
        .catch(() => {});
    }

    stopPoll();
    poll(); // immediate first poll
    pollRef.current = setInterval(poll, POLL_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status]);

  function handleStart() {
    if (!workId || !masterKey) return;
    setStartError(null);
    calledReadyRef.current = false;
    startTransition(async () => {
      const result = await startVideoProcessingJob(workId, targetField, masterKey);
      if ("error" in result) {
        setStartError(result.error);
      } else {
        setJob({ id: result.jobId, status: result.status, progress: 0, hlsUrl: null, errorMessage: null });
      }
    });
  }

  const isActive = !!(job && ACTIVE.has(job.status));
  const canStart = !!workId && !!masterKey && !isPending && !isActive;
  const style = job ? (STATUS_STYLE[job.status] ?? STATUS_STYLE.PENDING) : null;

  return (
    <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", fontFamily: "var(--font-body)" }}>

      {/* Process / Re-process button */}
      {!isActive && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart}
            style={{
              padding: "0.3rem 0.85rem",
              borderRadius: 3,
              border: "1px solid currentColor",
              background: canStart ? "rgba(99,102,241,0.12)" : "transparent",
              color: canStart ? "#818cf8" : "var(--color-brand-muted)",
              cursor: canStart ? "pointer" : "not-allowed",
              opacity: canStart ? 1 : 0.5,
              fontSize: "0.75rem",
            }}
          >
            {isPending ? "Starting…" : (job ? "Re-process" : buttonLabel)}
          </button>

          {!workId && (
            <span style={{ color: "var(--color-brand-muted)" }}>
              Save the work first to enable processing.
            </span>
          )}
          {workId && !masterKey && (
            <span style={{ color: "var(--color-brand-muted)" }}>
              Upload a master file to enable processing.
            </span>
          )}
        </div>
      )}

      {startError && (
        <p style={{ marginTop: "0.35rem", color: "#ef4444", margin: "0.35rem 0 0" }}>{startError}</p>
      )}

      {/* Active job: spinner hint */}
      {isActive && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--color-brand-muted)" }}>
          <span style={{ fontStyle: "italic" }}>Processing — polling every 5s…</span>
        </div>
      )}

      {/* Job status block */}
      {job && (
        <div style={{ marginTop: "0.5rem" }}>

          {/* Status badge + progress % */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{
              padding: "0.15rem 0.5rem", borderRadius: 3, fontWeight: 600,
              background: style!.bg, color: style!.color,
            }}>
              {job.status}
            </span>
            {job.status === "PROCESSING" && (
              <span style={{ color: "var(--color-brand-muted)" }}>{job.progress}%</span>
            )}
          </div>

          {/* Progress bar — shown for PENDING and PROCESSING */}
          {ACTIVE.has(job.status) && (
            <div style={{
              marginTop: "0.4rem", height: 4, borderRadius: 2,
              background: "rgba(255,255,255,0.08)", overflow: "hidden",
            }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: job.status === "PROCESSING" ? "#eab308" : "rgba(99,102,241,0.4)",
                width: `${Math.max(4, job.progress)}%`,
                transition: "width 0.4s ease",
              }} />
            </div>
          )}

          {/* Status message */}
          <div style={{ marginTop: "0.25rem", color: "var(--color-brand-muted)", lineHeight: 1.5 }}>
            {getStatusMessage(job.status, readyMessage, job.errorMessage)}
          </div>

          {/* READY: show the HLS URL that was written to the work */}
          {job.status === "READY" && job.hlsUrl && (
            <div style={{ marginTop: "0.35rem", wordBreak: "break-all" }}>
              <span style={{ color: "var(--color-brand-muted)" }}>URL: </span>
              <code style={{ color: "var(--color-brand-light)", fontSize: "0.7rem" }}>{job.hlsUrl}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
