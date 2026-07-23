"use client";

import { useState, useTransition, useEffect } from "react";
import {
  suspendUser,
  unsuspendUser,
  bulkSuspend,
  bulkUnsuspend,
  bulkDeactivate,
  bulkRestore,
  bulkPurge,
  deactivateUser,
  restoreUser,
  purgeUser,
  sendPasswordResetToUser,
} from "@/lib/actions/users-admin";
import { UserRoleForm } from "./user-role-form";

export type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  hasPassword: boolean;
  loginMethod: "google" | "email" | "multi";
  status: string;      // "ACTIVE" | "SUSPENDED" | "DEACTIVATED"
  suspendedAt: string | null;
  lastLoginAt: string | null;
  lastLoginProvider: string | null;
  deviceCount: number;
  savedWorksCount: number;
  progressCount: number;
  country: string | null;
  createdAt: string;
  isSelf: boolean;
};

interface Props {
  users: UserRow[];
  isFiltered: boolean;
  sessionRole: string;
}

type Feedback = { type: "error" | "success"; message: string };

export function UsersTable({ users, isFiltered, sessionRole }: Props) {
  const isSuperAdmin = sessionRole === "SUPER_ADMIN";
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [feedback, setFeedback]   = useState<Feedback | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Single purge modal ────────────────────────────────────────
  const [purgeTarget, setPurgeTarget] = useState<string | null>(null);
  const [purgePhrase, setPurgePhrase] = useState("");
  const [purgeError, setPurgeError]   = useState<string | null>(null);

  // ── Bulk purge modal ──────────────────────────────────────────
  const [bulkPurgeOpen, setBulkPurgeOpen]     = useState(false);
  const [bulkPurgePhrase, setBulkPurgePhrase] = useState("");
  const [bulkPurgeError, setBulkPurgeError]   = useState<string | null>(null);

  // ── Actions dropdown ──────────────────────────────────────────
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    if (!activeMenu) return;
    const close = () => setActiveMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [activeMenu]);

  // ── Selection helpers ──────────────────────────────────────
  const selectable = users.filter((u) => !u.isSelf);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(selectable.map((u) => u.id))); }
  function clearSelection() { setSelected(new Set()); }

  const allSelected = selectable.length > 0 && selected.size === selectable.length;

  // ── Bulk action eligibility ────────────────────────────────
  const selectedUsers      = users.filter((u) => selected.has(u.id));
  const suspendableCount   = selectedUsers.filter((u) => u.status === "ACTIVE" && !u.isSelf).length;
  const unsuspendableCount = selectedUsers.filter((u) => u.status === "SUSPENDED").length;
  const deactivatableCount = selectedUsers.filter((u) => (u.status === "ACTIVE" || u.status === "SUSPENDED") && !u.isSelf).length;
  const restorableCount    = selectedUsers.filter((u) => u.status === "DEACTIVATED").length;
  const purgableCount      = selectedUsers.filter((u) => !u.isSelf).length;

  // ── Single actions ─────────────────────────────────────────
  function handleSuspend(userId: string) {
    setFeedback(null);
    startTransition(async () => {
      const res = await suspendUser(userId);
      if (!res.ok) setFeedback({ type: "error", message: res.error ?? "Failed to suspend user." });
    });
  }

  function handleUnsuspend(userId: string) {
    setFeedback(null);
    startTransition(async () => {
      const res = await unsuspendUser(userId);
      if (!res.ok) setFeedback({ type: "error", message: res.error ?? "Failed to unsuspend user." });
    });
  }

  function handleDeactivate(userId: string) {
    setFeedback(null);
    startTransition(async () => {
      const res = await deactivateUser(userId);
      if (!res.ok) setFeedback({ type: "error", message: res.error ?? "Failed to deactivate user." });
    });
  }

  function handleRestore(userId: string) {
    setFeedback(null);
    startTransition(async () => {
      const res = await restoreUser(userId);
      if (!res.ok) setFeedback({ type: "error", message: res.error ?? "Failed to restore user." });
    });
  }

  function handleResetEmail(userId: string) {
    setFeedback(null);
    startTransition(async () => {
      const res = await sendPasswordResetToUser(userId, null, new FormData());
      setFeedback({ type: res.ok ? "success" : "error", message: res.message });
    });
  }

  // ── Single purge ──────────────────────────────────────────
  function openPurge(userId: string) {
    setPurgeTarget(userId);
    setPurgePhrase("");
    setPurgeError(null);
  }

  function closePurge() {
    setPurgeTarget(null);
    setPurgePhrase("");
    setPurgeError(null);
  }

  function handlePurge() {
    if (!purgeTarget) return;
    setPurgeError(null);
    startTransition(async () => {
      const res = await purgeUser(purgeTarget, purgePhrase);
      if (res.ok) {
        closePurge();
      } else {
        setPurgeError(res.error ?? "Purge failed.");
      }
    });
  }

  // ── Bulk actions ──────────────────────────────────────────
  function handleBulkSuspend() {
    setFeedback(null);
    const ids = selectedUsers.filter((u) => u.status === "ACTIVE" && !u.isSelf).map((u) => u.id);
    startTransition(async () => {
      await bulkSuspend(ids);
      clearSelection();
    });
  }

  function handleBulkUnsuspend() {
    setFeedback(null);
    const ids = selectedUsers.filter((u) => u.status === "SUSPENDED").map((u) => u.id);
    startTransition(async () => {
      await bulkUnsuspend(ids);
      clearSelection();
    });
  }

  function handleBulkDeactivate() {
    setFeedback(null);
    const ids = selectedUsers.filter((u) => (u.status === "ACTIVE" || u.status === "SUSPENDED") && !u.isSelf).map((u) => u.id);
    startTransition(async () => {
      const res = await bulkDeactivate(ids);
      if (!res.ok) setFeedback({ type: "error", message: res.error ?? "Deactivation failed." });
      else clearSelection();
    });
  }

  function handleBulkRestore() {
    setFeedback(null);
    const ids = selectedUsers.filter((u) => u.status === "DEACTIVATED").map((u) => u.id);
    startTransition(async () => {
      const res = await bulkRestore(ids);
      if (!res.ok) setFeedback({ type: "error", message: res.error ?? "Restore failed." });
      else clearSelection();
    });
  }

  function openBulkPurge() {
    setBulkPurgeOpen(true);
    setBulkPurgePhrase("");
    setBulkPurgeError(null);
  }

  function closeBulkPurge() {
    setBulkPurgeOpen(false);
    setBulkPurgePhrase("");
    setBulkPurgeError(null);
  }

  function handleBulkPurge() {
    setBulkPurgeError(null);
    const ids = selectedUsers.filter((u) => !u.isSelf).map((u) => u.id);
    startTransition(async () => {
      const res = await bulkPurge(ids, bulkPurgePhrase);
      if (res.ok) {
        closeBulkPurge();
        clearSelection();
      } else {
        setBulkPurgeError(res.error ?? "Bulk purge failed.");
      }
    });
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      {/* Single purge modal */}
      {purgeTarget && (
        <div className="purge-overlay" onClick={(e) => { if (e.target === e.currentTarget) closePurge(); }}>
          <div className="purge-modal" role="dialog" aria-modal="true" aria-label="Purge user confirmation">
            <h3 className="purge-modal-title">Purge Permanently</h3>
            <p className="purge-modal-body">
              This will permanently delete this user and <strong>all connected records</strong> —
              profile, sessions, OAuth links, watch progress, saved list, likes, notifications,
              preferences, login history, Notify Me signups, and queued emails.
              Analytics are anonymised. Audit logs are preserved.
            </p>
            <p className="purge-modal-body" style={{ marginTop: "0.5rem" }}>
              <strong>This cannot be undone.</strong>
            </p>
            <label className="purge-modal-label">
              Type <code className="purge-code">PURGE</code> to confirm:
            </label>
            <input
              type="text"
              value={purgePhrase}
              onChange={(e) => setPurgePhrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && purgePhrase === "PURGE" && handlePurge()}
              placeholder="PURGE"
              className="purge-modal-input"
              autoFocus
            />
            {purgeError && <p className="purge-modal-error">{purgeError}</p>}
            <div className="purge-modal-actions">
              <button onClick={closePurge} className="purge-cancel-btn" disabled={isPending}>Cancel</button>
              <button
                onClick={handlePurge}
                disabled={purgePhrase !== "PURGE" || isPending}
                className="purge-confirm-btn"
              >
                {isPending ? "Purging…" : "Purge Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk purge modal */}
      {bulkPurgeOpen && (
        <div className="purge-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeBulkPurge(); }}>
          <div className="purge-modal" role="dialog" aria-modal="true" aria-label="Bulk purge confirmation">
            <h3 className="purge-modal-title">Purge {purgableCount} User{purgableCount !== 1 ? "s" : ""} Permanently</h3>
            <p className="purge-modal-body">
              This will permanently delete <strong>{purgableCount} user account{purgableCount !== 1 ? "s" : ""}</strong> and
              all connected records. Analytics are anonymised. Audit logs are preserved.
            </p>
            <p className="purge-modal-body" style={{ marginTop: "0.5rem" }}>
              <strong>This cannot be undone.</strong>
            </p>
            <label className="purge-modal-label">
              Type <code className="purge-code">PURGE</code> to confirm:
            </label>
            <input
              type="text"
              value={bulkPurgePhrase}
              onChange={(e) => setBulkPurgePhrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && bulkPurgePhrase === "PURGE" && handleBulkPurge()}
              placeholder="PURGE"
              className="purge-modal-input"
              autoFocus
            />
            {bulkPurgeError && <p className="purge-modal-error">{bulkPurgeError}</p>}
            <div className="purge-modal-actions">
              <button onClick={closeBulkPurge} className="purge-cancel-btn" disabled={isPending}>Cancel</button>
              <button
                onClick={handleBulkPurge}
                disabled={bulkPurgePhrase !== "PURGE" || isPending}
                className="purge-confirm-btn"
              >
                {isPending ? "Purging…" : `Purge ${purgableCount} Permanently`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback banner */}
      {feedback && (
        <div className={`ufeedback-bar ufeedback-bar--${feedback.type}`} role="alert">
          {feedback.message}
          <button onClick={() => setFeedback(null)} className="ufeedback-close">✕</button>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="ubulk-bar">
          <span className="ubulk-count">{selected.size} selected</span>
          <button onClick={clearSelection} className="ubulk-btn ubulk-btn--ghost" disabled={isPending}>
            Clear
          </button>
          {suspendableCount > 0 && (
            <button onClick={handleBulkSuspend} disabled={isPending} className="ubulk-btn ubulk-btn--warn">
              Suspend {suspendableCount}
            </button>
          )}
          {unsuspendableCount > 0 && (
            <button onClick={handleBulkUnsuspend} disabled={isPending} className="ubulk-btn">
              Unsuspend {unsuspendableCount}
            </button>
          )}
          {deactivatableCount > 0 && (
            <button onClick={handleBulkDeactivate} disabled={isPending} className="ubulk-btn ubulk-btn--warn">
              Deactivate {deactivatableCount}
            </button>
          )}
          {restorableCount > 0 && (
            <button onClick={handleBulkRestore} disabled={isPending} className="ubulk-btn ubulk-btn--restore">
              Restore {restorableCount}
            </button>
          )}
          {purgableCount > 0 && (
            <button onClick={openBulkPurge} disabled={isPending} className="ubulk-btn ubulk-btn--danger">
              Purge {purgableCount}
            </button>
          )}
          {isPending && <span className="ubulk-spinner" />}
        </div>
      )}

      {/* Table */}
      <div
        className={`admin-table-wrap utbl-wrap${isPending ? " utable--pending" : ""}`}
        style={{ marginTop: selected.size > 0 ? "0" : "0.75rem" }}
      >
        <table className="admin-table">
          <colgroup>
            <col style={{ width: 40 }} />
            <col />
            <col style={{ width: 110 }} />
            <col style={{ width: 75 }} />
            <col style={{ width: 95 }} />
            <col style={{ width: 58 }} />
            <col style={{ width: 88 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 110 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ paddingRight: 0 }}>
                <input
                  type="checkbox"
                  className="ubulk-checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = selected.size > 0 && !allSelected;
                  }}
                  onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                  aria-label="Select all"
                />
              </th>
              <th>User</th>
              <th>Role</th>
              <th>Via</th>
              <th>Status</th>
              <th>Country</th>
              <th>Activity</th>
              <th>Last Login</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className={[
                  u.isSelf ? "urow--self" : "",
                  u.status === "SUSPENDED"   ? "urow--suspended"   : "",
                  u.status === "DEACTIVATED" ? "urow--deactivated" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {/* Checkbox */}
                <td style={{ paddingRight: 0 }}>
                  <input
                    type="checkbox"
                    className="ubulk-checkbox"
                    checked={selected.has(u.id)}
                    disabled={u.isSelf}
                    onChange={() => toggle(u.id)}
                    aria-label={`Select ${u.email}`}
                  />
                </td>

                {/* Name + Email */}
                <td>
                  <div className="ucell-name">
                    {u.name ?? <span className="ucell-anon">No name</span>}
                    {u.isSelf && <span className="uself-tag">you</span>}
                  </div>
                  <div className="ucell-email">{u.email}</div>
                </td>

                {/* Role */}
                <td>
                  {isSuperAdmin ? (
                    <UserRoleForm userId={u.id} currentRole={u.role} isSelf={u.isSelf} />
                  ) : (
                    <span className={`role-badge role-badge--${u.role === "SUPER_ADMIN" ? "super" : u.role === "ADMIN" ? "admin" : "user"}`}>
                      {u.role === "SUPER_ADMIN" ? "Super Admin" : u.role === "ADMIN" ? "Admin" : "Member"}
                    </span>
                  )}
                </td>

                {/* Login method */}
                <td>
                  <span className={`uvia-badge uvia-badge--${u.loginMethod}`}>
                    {u.loginMethod === "google" ? "Google" : u.loginMethod === "email" ? "Email" : "Multi"}
                  </span>
                </td>

                {/* Status */}
                <td>
                  {u.status === "SUSPENDED" ? (
                    <span
                      className="ustatus-badge ustatus-badge--suspended"
                      title={u.suspendedAt ? `Suspended ${new Date(u.suspendedAt).toLocaleDateString("en-GB", { timeZone: "UTC" })}` : "Suspended"}
                    >
                      Suspended
                    </span>
                  ) : u.status === "DEACTIVATED" ? (
                    <span className="ustatus-badge ustatus-badge--deactivated">Deactivated</span>
                  ) : (
                    <span className="ustatus-badge ustatus-badge--active">Active</span>
                  )}
                </td>

                {/* Country */}
                <td className="ucell-country">
                  {u.country ?? <span className="ucell-muted">—</span>}
                </td>

                {/* Activity: saves / progress / devices stacked */}
                <td>
                  <div className="ucell-acts">
                    <div><span className="ucell-act-n">{u.savedWorksCount}</span> saves</div>
                    <div><span className="ucell-act-n">{u.progressCount}</span> progress</div>
                    <div><span className="ucell-act-n">{u.deviceCount}</span> devices</div>
                  </div>
                </td>

                {/* Last login */}
                <td className="ucell-date">
                  {u.lastLoginAt ? (
                    <>
                      {new Date(u.lastLoginAt).toLocaleDateString("en-GB", {
                        day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
                      })}
                      {u.lastLoginProvider && (
                        <div className="ucell-login-via">{u.lastLoginProvider}</div>
                      )}
                    </>
                  ) : (
                    <span className="ucell-never">Never</span>
                  )}
                </td>

                {/* Joined */}
                <td className="ucell-date">
                  {new Date(u.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
                  })}
                </td>

                {/* Actions dropdown */}
                <td>
                  {u.isSelf ? (
                    <span className="ucell-muted">—</span>
                  ) : (
                    <div className="uactions-wrap">
                      <button
                        className="uactions-trigger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === u.id ? null : u.id);
                        }}
                        disabled={isPending}
                        aria-haspopup="true"
                        aria-expanded={activeMenu === u.id}
                      >
                        Actions <span className="uactions-arrow">▾</span>
                      </button>
                      {activeMenu === u.id && (
                        <div className="uactions-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                          {/* Transactional */}
                          {u.hasPassword && (
                            <button
                              role="menuitem"
                              className="uaction-item"
                              onClick={() => { setActiveMenu(null); handleResetEmail(u.id); }}
                            >
                              Send Reset Email
                            </button>
                          )}

                          {/* Status transitions */}
                          {u.status === "ACTIVE" && (
                            <button
                              role="menuitem"
                              className="uaction-item uaction-item--warn"
                              onClick={() => { setActiveMenu(null); handleSuspend(u.id); }}
                            >
                              Suspend
                            </button>
                          )}
                          {u.status === "SUSPENDED" && (
                            <button
                              role="menuitem"
                              className="uaction-item"
                              onClick={() => { setActiveMenu(null); handleUnsuspend(u.id); }}
                            >
                              Unsuspend
                            </button>
                          )}
                          {(u.status === "ACTIVE" || u.status === "SUSPENDED") && (
                            <button
                              role="menuitem"
                              className="uaction-item uaction-item--warn"
                              onClick={() => { setActiveMenu(null); handleDeactivate(u.id); }}
                            >
                              Deactivate
                            </button>
                          )}
                          {u.status === "DEACTIVATED" && (
                            <button
                              role="menuitem"
                              className="uaction-item"
                              onClick={() => { setActiveMenu(null); handleRestore(u.id); }}
                            >
                              Restore
                            </button>
                          )}

                          {/* Destructive — always last */}
                          <div className="uaction-sep" />
                          <button
                            role="menuitem"
                            className="uaction-item uaction-item--danger"
                            onClick={() => { setActiveMenu(null); openPurge(u.id); }}
                          >
                            Purge Permanently
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}

            {users.length === 0 && (
              <tr>
                <td colSpan={10} className="table-empty">
                  {isFiltered ? "No users match your filters." : "No users yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
