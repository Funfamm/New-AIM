"use client";

import { useState, useTransition } from "react";
import { CheckCircle, XCircle, MinusCircle, Clock, SkipForward, Eye } from "lucide-react";
import { bulkDeleteLogs, clearOldLogs } from "@/lib/actions/email-admin";

export type LogRow = {
  id:        string;
  to:        string;
  subject:   string;
  type:      string;
  provider:  string;
  status:    string;
  error:     string | null;
  openedAt:  string | null; // ISO string or null
  clickedAt: string | null;
  createdAt: string;
};

function statusIcon(status: string) {
  if (status === "SENT")       return <CheckCircle  size={13} className="elog-sent"       />;
  if (status === "FAILED")     return <XCircle      size={13} className="elog-failed"     />;
  if (status === "SUPPRESSED") return <MinusCircle  size={13} className="elog-suppressed" />;
  if (status === "QUEUED")     return <Clock        size={13} className="elog-queued"     />;
  if (status === "SKIPPED")    return <SkipForward  size={13} className="elog-skipped"    />;
  return null;
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export default function LogsTable({ logs }: { logs: LogRow[] }) {
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [msg,         setMsg]         = useState<{ text: string; ok: boolean } | null>(null);
  const [clearDays,   setClearDays]   = useState(30);
  const [deleting,    startDelete]    = useTransition();
  const [clearing,    startClear]     = useTransition();

  const allSelected  = logs.length > 0 && logs.every((l) => selected.has(l.id));
  const someSelected = selected.size > 0;
  const isPending    = deleting || clearing;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(logs.map((l) => l.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function flash(text: string, ok: boolean) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 5000);
  }

  function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} log entr${selected.size === 1 ? "y" : "ies"}?`)) return;
    startDelete(async () => {
      const res = await bulkDeleteLogs([...selected]);
      setSelected(new Set());
      flash(res.message, res.ok);
    });
  }

  function handleClearOld() {
    if (!confirm(`Delete all logs older than ${clearDays} days?`)) return;
    startClear(async () => {
      const res = await clearOldLogs(clearDays);
      flash(res.message, res.ok);
    });
  }

  return (
    <>
      {/* Bulk ops strip */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(107,114,128,0.6)", fontFamily: "var(--font-body)" }}>
          Housekeeping
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <span style={{ fontSize: "0.78rem", color: "rgba(107,114,128,0.75)", fontFamily: "var(--font-body)" }}>Clear older than</span>
          <select
            value={clearDays}
            onChange={(e) => setClearDays(Number(e.target.value))}
            disabled={isPending}
            style={{ height: 30, padding: "0 0.6rem", borderRadius: 6, background: "#0d0d0d", border: "1px solid #2a2a2a", color: "#e5e7eb", fontFamily: "var(--font-body)", fontSize: "0.78rem", outline: "none" }}
          >
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>
          <button
            className="ebulk-btn ebulk-btn--ghost"
            disabled={isPending}
            onClick={handleClearOld}
          >
            {clearing ? "Clearing…" : "Clear"}
          </button>
        </div>
      </div>

      {/* Feedback */}
      {msg && (
        <p className={`ebulk-msg ebulk-msg--${msg.ok ? "ok" : "err"}`}>
          {msg.ok ? "✓" : "⚠"} {msg.text}
        </p>
      )}

      {/* Bulk action bar when rows selected */}
      {someSelected && (
        <div className="ebulk-bar">
          <span className="ebulk-count">{selected.size} selected</span>
          <button
            className="ebulk-btn ebulk-btn--red"
            disabled={isPending}
            onClick={handleBulkDelete}
          >
            {deleting ? "Deleting…" : `Delete (${selected.size})`}
          </button>
          <div className="ebulk-divider" />
          <button
            className="ebulk-btn ebulk-btn--ghost"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      {logs.length === 0 ? (
        <p className="email-empty">No logs match the current filter.</p>
      ) : (
        <div className="email-log-wrap">
          <div className="email-log-scroll">
            <table className="email-log-table">
              <thead>
                <tr>
                  <th className="echk-cell">
                    <input
                      type="checkbox"
                      className="echk"
                      checked={allSelected}
                      onChange={toggleAll}
                      title="Select all"
                    />
                  </th>
                  <th>Status</th><th>To</th><th>Subject</th>
                  <th>Type</th><th>Provider</th><th>Opened</th><th>Clicked</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <>
                    <tr key={log.id} style={selected.has(log.id) ? { background: "rgba(226,184,101,0.04)" } : undefined}>
                      <td className="echk-cell">
                        <input
                          type="checkbox"
                          className="echk"
                          checked={selected.has(log.id)}
                          onChange={() => toggle(log.id)}
                        />
                      </td>
                      <td>
                        <span className="elog-status-cell">
                          {statusIcon(log.status)}
                          <span>{log.status}</span>
                        </span>
                      </td>
                      <td className="elog-to">{log.to}</td>
                      <td className="elog-subject" title={log.subject}>{log.subject}</td>
                      <td><span className="elog-badge">{log.type}</span></td>
                      <td className="elog-provider">{log.provider}</td>
                      <td className="elog-date">
                        {log.openedAt ? (
                          <span title={fmtDate(log.openedAt)} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#4ade80" }}>
                            <Eye size={12} />
                            {fmtDate(log.openedAt)}
                          </span>
                        ) : (
                          <span style={{ color: "#374151" }}>—</span>
                        )}
                      </td>
                      <td className="elog-date">
                        {log.clickedAt ? (
                          <span title={fmtDate(log.clickedAt)} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#e8c97e" }}>
                            <Eye size={12} />
                            {fmtDate(log.clickedAt)}
                          </span>
                        ) : (
                          <span style={{ color: "#374151" }}>—</span>
                        )}
                      </td>
                      <td className="elog-date">{fmtDate(log.createdAt)}</td>
                    </tr>
                    {log.status === "FAILED" && log.error && (
                      <tr key={`${log.id}-err`} className="elog-error-row">
                        <td /><td />
                        <td colSpan={7} className="elog-error-cell">
                          {log.error.slice(0, 300)}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
