"use client";

import { useState, useTransition } from "react";
import {
  suspendUser,
  unsuspendUser,
  bulkSuspend,
  bulkUnsuspend,
} from "@/lib/actions/users-admin";
import { UserRoleForm } from "./user-role-form";
import { UserResetBtn } from "./user-reset-btn";

export type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  hasPassword: boolean;
  loginMethod: "google" | "email" | "multi";
  status: string;      // "ACTIVE" | "SUSPENDED"
  suspendedAt: string | null;
  savedWorksCount: number;
  progressCount: number;
  createdAt: string;
  isSelf: boolean;
};

interface Props {
  users: UserRow[];
  isFiltered: boolean;
}

export function UsersTable({ users, isFiltered }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Selection helpers ──────────────────────────────────────
  const selectable = users.filter((u) => !u.isSelf);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(selectable.map((u) => u.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const allSelected =
    selectable.length > 0 && selected.size === selectable.length;

  // ── Derive bulk action eligibility ────────────────────────
  const selectedUsers = users.filter((u) => selected.has(u.id));
  const suspendableCount = selectedUsers.filter(
    (u) => u.status === "ACTIVE" && !u.isSelf
  ).length;
  const unsuspendableCount = selectedUsers.filter(
    (u) => u.status === "SUSPENDED"
  ).length;

  // ── Single-user actions ───────────────────────────────────
  function handleSuspend(userId: string) {
    setError(null);
    startTransition(async () => {
      const res = await suspendUser(userId);
      if (!res.ok) setError(res.error ?? "Failed to suspend user.");
    });
  }

  function handleUnsuspend(userId: string) {
    setError(null);
    startTransition(async () => {
      const res = await unsuspendUser(userId);
      if (!res.ok) setError(res.error ?? "Failed to unsuspend user.");
    });
  }

  // ── Bulk actions ──────────────────────────────────────────
  function handleBulkSuspend() {
    setError(null);
    const ids = selectedUsers
      .filter((u) => u.status === "ACTIVE" && !u.isSelf)
      .map((u) => u.id);
    startTransition(async () => {
      await bulkSuspend(ids);
      clearSelection();
    });
  }

  function handleBulkUnsuspend() {
    setError(null);
    const ids = selectedUsers
      .filter((u) => u.status === "SUSPENDED")
      .map((u) => u.id);
    startTransition(async () => {
      await bulkUnsuspend(ids);
      clearSelection();
    });
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      {/* Error banner */}
      {error && (
        <div className="ubulk-error" role="alert">
          {error}
          <button onClick={() => setError(null)} className="ubulk-error-close">✕</button>
        </div>
      )}

      {/* Bulk action bar — shown when ≥ 1 selected */}
      {selected.size > 0 && (
        <div className="ubulk-bar">
          <span className="ubulk-count">{selected.size} selected</span>
          <button onClick={clearSelection} className="ubulk-btn ubulk-btn--ghost" disabled={isPending}>
            Clear
          </button>
          {suspendableCount > 0 && (
            <button
              onClick={handleBulkSuspend}
              disabled={isPending}
              className="ubulk-btn ubulk-btn--warn"
            >
              Suspend {suspendableCount}
            </button>
          )}
          {unsuspendableCount > 0 && (
            <button
              onClick={handleBulkUnsuspend}
              disabled={isPending}
              className="ubulk-btn"
            >
              Unsuspend {unsuspendableCount}
            </button>
          )}
          {isPending && <span className="ubulk-spinner" />}
        </div>
      )}

      {/* Table */}
      <div
        className={`admin-table-wrap${isPending ? " utable--pending" : ""}`}
        style={{ marginTop: selected.size > 0 ? "0" : "0.75rem" }}
      >
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 36, paddingRight: 0 }}>
                <input
                  type="checkbox"
                  className="ubulk-checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el)
                      el.indeterminate =
                        selected.size > 0 && !allSelected;
                  }}
                  onChange={(e) =>
                    e.target.checked ? selectAll() : clearSelection()
                  }
                  aria-label="Select all"
                />
              </th>
              <th>User</th>
              <th>Role</th>
              <th>Via</th>
              <th>Status</th>
              <th style={{ textAlign: "center" }}>Saved</th>
              <th style={{ textAlign: "center" }}>Progress</th>
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
                  u.status === "SUSPENDED" ? "urow--suspended" : "",
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

                {/* Role — inline change */}
                <td>
                  <UserRoleForm
                    userId={u.id}
                    currentRole={u.role}
                    isSelf={u.isSelf}
                  />
                </td>

                {/* Login method */}
                <td>
                  <span className={`uvia-badge uvia-badge--${u.loginMethod}`}>
                    {u.loginMethod === "google"
                      ? "Google"
                      : u.loginMethod === "email"
                      ? "Email"
                      : "Multi"}
                  </span>
                </td>

                {/* Status badge */}
                <td>
                  {u.status === "SUSPENDED" ? (
                    <span
                      className="ustatus-badge ustatus-badge--suspended"
                      title={
                        u.suspendedAt
                          ? `Suspended ${new Date(u.suspendedAt).toLocaleDateString()}`
                          : "Suspended"
                      }
                    >
                      Suspended
                    </span>
                  ) : (
                    <span className="ustatus-badge ustatus-badge--active">
                      Active
                    </span>
                  )}
                </td>

                {/* Saved works */}
                <td style={{ textAlign: "center" }}>
                  <span className="ucell-count">{u.savedWorksCount}</span>
                </td>

                {/* Watch progress */}
                <td style={{ textAlign: "center" }}>
                  <span className="ucell-count">{u.progressCount}</span>
                </td>

                {/* Joined */}
                <td className="ucell-date">
                  {new Date(u.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>

                {/* Actions */}
                <td>
                  <div className="action-btns">
                    {u.hasPassword && <UserResetBtn userId={u.id} />}
                    {!u.isSelf && u.status === "ACTIVE" && (
                      <button
                        onClick={() => handleSuspend(u.id)}
                        disabled={isPending}
                        className="action-btn action-btn--danger"
                        title="Suspend user"
                        style={{ fontSize: "1rem", lineHeight: 1 }}
                      >
                        ⊘
                      </button>
                    )}
                    {!u.isSelf && u.status === "SUSPENDED" && (
                      <button
                        onClick={() => handleUnsuspend(u.id)}
                        disabled={isPending}
                        className="action-btn"
                        title="Unsuspend user"
                        style={{ fontSize: "0.8rem", lineHeight: 1 }}
                      >
                        ↺
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {users.length === 0 && (
              <tr>
                <td colSpan={9} className="table-empty">
                  {isFiltered
                    ? "No users match your filters."
                    : "No users yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
