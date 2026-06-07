"use client";

import { useState, useEffect, useCallback } from "react";

type WorkerState = { online: boolean; busy?: boolean; uptime?: number } | null;

export default function WorkerStatus() {
  const [state, setState] = useState<WorkerState>(null);
  const [triggering, setTriggering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/worker/status", { cache: "no-store" });
      setState(await res.json());
    } catch {
      setState({ online: false });
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  async function trigger() {
    setTriggering(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/worker/run", { method: "POST" });
      const data = await res.json() as { status?: string; error?: string; message?: string };
      if (res.status === 503 || data.error) {
        setMessage(data.error ?? "Worker unreachable");
      } else if (data.status === "busy") {
        setMessage("Already processing — reload to see progress");
      } else {
        setMessage("Job triggered — reload this page to see progress");
      }
      await check();
    } finally {
      setTriggering(false);
    }
  }

  const dot = state === null ? "#6b7280"
    : !state.online ? "#ef4444"
    : state.busy    ? "#eab308"
    : "#22c55e";

  const label = state === null ? "Checking..."
    : !state.online ? "Worker offline"
    : state.busy    ? "Worker busy"
    : "Worker online";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.75rem",
      fontSize: "0.75rem", fontFamily: "var(--font-body)",
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: dot, display: "inline-block", flexShrink: 0,
        }} />
        <span style={{ color: "var(--color-brand-muted)" }}>{label}</span>
      </span>

      <button
        onClick={trigger}
        disabled={triggering || !state?.online || !!state?.busy}
        style={{
          padding: "0.2rem 0.65rem", borderRadius: 3,
          border: "1px solid currentColor",
          background: "transparent",
          color: "var(--color-brand-muted)",
          cursor: (triggering || !state?.online || state?.busy) ? "not-allowed" : "pointer",
          opacity: (triggering || !state?.online || state?.busy) ? 0.45 : 1,
          fontSize: "0.75rem",
        }}
      >
        {triggering ? "Starting…" : "Run Worker"}
      </button>

      <button
        onClick={() => { setMessage(null); check(); }}
        style={{
          padding: "0.2rem 0.5rem", borderRadius: 3,
          border: "1px solid currentColor",
          background: "transparent",
          color: "var(--color-brand-muted)",
          cursor: "pointer",
          fontSize: "0.75rem",
        }}
        title="Re-check worker status"
      >
        ↻
      </button>

      {message && (
        <span style={{ color: "var(--color-brand-muted)" }}>{message}</span>
      )}
    </div>
  );
}
