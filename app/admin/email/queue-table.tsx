"use client";

import { useState, useTransition } from "react";
import {
  retryQueueItem,
  bulkRetryQueueItems,
  bulkCancelQueueItems,
} from "@/lib/actions/email-admin";

export type QueueRow = {
  id:          string;
  to:          string;
  subject:     string;
  type:        string;
  campaignId:  string | null;
  retryCount:  number;
  maxRetries:  number;
  status:      string;
  error:       string | null;
  createdAt:   string; // ISO string from server
};

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function statusClass(s: string) {
  if (s === "SENT")   return "elog-sent";
  if (s === "FAILED") return "elog-failed";
  if (s === "QUEUED") return "elog-queued";
  return "";
}

function statusBg(s: string) {
  if (s === "SENT")   return { background: "rgba(74,222,128,0.1)",  borderColor: "rgba(74,222,128,0.2)",  color: "#4ade80" };
  if (s === "FAILED") return { background: "rgba(248,113,113,0.1)", borderColor: "rgba(248,113,113,0.2)", color: "#f87171" };
  if (s === "QUEUED") return { background: "rgba(245,158,11,0.1)",  borderColor: "rgba(245,158,11,0.2)",  color: "#f59e0b" };
  return {};
}

export default function QueueTable({ items }: { items: QueueRow[] }) {
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [msg,       setMsg]       = useState<{ text: string; ok: boolean } | null>(null);
  const [retrying,  startRetry]   = useTransition();
  const [cancelling,startCancel]  = useTransition();
  const [rowPending,startRow]     = useTransition();

  const failedIds  = items.filter((i) => i.status === "FAILED").map((i) => i.id);
  const queuedIds  = items.filter((i) => i.status === "QUEUED").map((i) => i.id);
  const selectableIds = [...failedIds, ...queuedIds];

  const allSelected    = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelected   = selected.size > 0;

  const selectedFailed  = [...selected].filter((id) => failedIds.includes(id));
  const selectedQueued  = [...selected].filter((id) => queuedIds.includes(id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
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
    setTimeout(() => setMsg(null), 4000);
  }

  function handleBulkRetry() {
    startRetry(async () => {
      const res = await bulkRetryQueueItems(selectedFailed);
      setSelected(new Set());
      flash(res.message, res.ok);
    });
  }

  function handleBulkCancel() {
    startCancel(async () => {
      const ids = [...selected].filter((id) => [...failedIds, ...queuedIds].includes(id));
      const res = await bulkCancelQueueItems(ids);
      setSelected(new Set());
      flash(res.message, res.ok);
    });
  }

  function handleRowRetry(id: string) {
    startRow(async () => {
      const res = await retryQueueItem(id);
      flash(res.message, res.ok);
    });
  }

  if (items.length === 0) return null;

  const isPending = retrying || cancelling || rowPending;

  return (
    <>
      {/* Feedback message */}
      {msg && (
        <p className={`ebulk-msg ebulk-msg--${msg.ok ? "ok" : "err"}`}>
          {msg.ok ? "✓" : "⚠"} {msg.text}
        </p>
      )}

      {/* Bulk action bar */}
      {someSelected && (
        <div className="ebulk-bar">
          <span className="ebulk-count">{selected.size} selected</span>

          {selectedFailed.length > 0 && (
            <button
              className="ebulk-btn ebulk-btn--gold"
              disabled={isPending}
              onClick={handleBulkRetry}
            >
              {retrying ? "Retrying…" : `Retry failed (${selectedFailed.length})`}
            </button>
          )}

          {(selectedFailed.length > 0 || selectedQueued.length > 0) && (
            <button
              className="ebulk-btn ebulk-btn--red"
              disabled={isPending}
              onClick={handleBulkCancel}
            >
              {cancelling ? "Cancelling…" : `Cancel (${selected.size})`}
            </button>
          )}

          <div className="ebulk-divider" />
          <button
            className="ebulk-btn ebulk-btn--ghost"
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
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
                <th>Status</th><th>To</th><th>Type</th>
                <th>Campaign</th><th>Retries</th><th>Date</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isSelectable = item.status === "FAILED" || item.status === "QUEUED";
                return (
                  <>
                    <tr key={item.id} style={selected.has(item.id) ? { background: "rgba(226,184,101,0.04)" } : undefined}>
                      <td className="echk-cell">
                        {isSelectable && (
                          <input
                            type="checkbox"
                            className="echk"
                            checked={selected.has(item.id)}
                            onChange={() => toggle(item.id)}
                          />
                        )}
                      </td>
                      <td>
                        <span className={`elog-badge ${statusClass(item.status)}`} style={statusBg(item.status)}>
                          {item.status}
                        </span>
                      </td>
                      <td className="elog-to">{item.to}</td>
                      <td><span className="elog-badge">{item.type}</span></td>
                      <td className="elog-provider">{item.campaignId ?? "—"}</td>
                      <td className="elog-provider" style={{ textAlign: "center" }}>
                        {item.retryCount} / {item.maxRetries}
                      </td>
                      <td className="elog-date">{fmtDate(item.createdAt)}</td>
                      <td>
                        {item.status === "FAILED" && (
                          <button
                            className="erow-btn erow-btn--gold"
                            disabled={isPending}
                            onClick={() => handleRowRetry(item.id)}
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                    {item.status === "FAILED" && item.error && (
                      <tr key={`${item.id}-err`} className="elog-error-row">
                        <td />
                        <td />
                        <td colSpan={6} className="elog-error-cell">
                          {item.error.slice(0, 300)}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
