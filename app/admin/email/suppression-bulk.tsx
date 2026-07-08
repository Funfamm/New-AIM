"use client";

import { useState, useTransition } from "react";
import { bulkRemoveSuppressions, bulkDeleteSuppressions } from "@/lib/actions/email-admin";

export type SuppressionRow = {
  id:        string;
  email:     string;
  reason:    string | null;
  source:    string | null;
  createdAt: string; // ISO string
};

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "UTC", // pin to UTC so SSR (server) and hydration (client) render identical text — avoids React #418
  }).format(new Date(iso));
}

export default function SuppressionBulk({ rows }: { rows: SuppressionRow[] }) {
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [msg,        setMsg]        = useState<{ text: string; ok: boolean } | null>(null);
  const [removing,   startRemove]   = useTransition();
  const [deleting,   startDelete]   = useTransition();

  const allSelected  = rows.length > 0 && rows.every((r) => selected.has(r.email));
  const someSelected = selected.size > 0;
  const isPending    = removing || deleting;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.email)));
    }
  }

  function toggle(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  }

  function flash(text: string, ok: boolean) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 5000);
  }

  function handleBulkRemove() {
    startRemove(async () => {
      const res = await bulkRemoveSuppressions([...selected]);
      setSelected(new Set());
      flash(res.message, res.ok);
    });
  }

  function handleBulkDelete() {
    if (!confirm(`Permanently delete ${selected.size} suppression record${selected.size === 1 ? "" : "s"}? This cannot be undone.`)) return;
    startDelete(async () => {
      const res = await bulkDeleteSuppressions([...selected]);
      setSelected(new Set());
      flash(res.message, res.ok);
    });
  }

  if (rows.length === 0) return <p className="email-empty">No active suppressions.</p>;

  return (
    <>
      {msg && (
        <p className={`ebulk-msg ebulk-msg--${msg.ok ? "ok" : "err"}`}>
          {msg.ok ? "✓" : "⚠"} {msg.text}
        </p>
      )}

      {someSelected && (
        <div className="ebulk-bar">
          <span className="ebulk-count">{selected.size} selected</span>
          <button
            className="ebulk-btn ebulk-btn--ghost"
            disabled={isPending}
            onClick={handleBulkRemove}
          >
            {removing ? "Removing…" : `Remove (${selected.size})`}
          </button>
          <button
            className="ebulk-btn ebulk-btn--red"
            disabled={isPending}
            onClick={handleBulkDelete}
          >
            {deleting ? "Deleting…" : `Delete permanently (${selected.size})`}
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

      <div className="email-log-wrap">
        <div className="email-log-scroll">
          <table className="email-sup-table">
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
                <th>Email</th><th>Reason</th><th>Source</th><th>Added</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={selected.has(row.email) ? { background: "rgba(226,184,101,0.04)" } : undefined}>
                  <td className="echk-cell">
                    <input
                      type="checkbox"
                      className="echk"
                      checked={selected.has(row.email)}
                      onChange={() => toggle(row.email)}
                    />
                  </td>
                  <td>{row.email}</td>
                  <td className="elog-provider">{row.reason ?? "—"}</td>
                  <td className="elog-provider">{row.source ?? "—"}</td>
                  <td className="elog-date">{fmtDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
