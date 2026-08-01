"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminDeleteRole } from "@/lib/actions/casting";
import type { adminGetRoles } from "@/lib/actions/casting";

type Role = Awaited<ReturnType<typeof adminGetRoles>>[number];

export default function RolesClient({ roles }: { roles: Role[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeleteError(null);
    setDeletingId(id);
    startTransition(async () => {
      const result = await adminDeleteRole(id);
      if (result.ok) {
        router.refresh();
      } else {
        setDeleteError(result.error ?? "Delete failed.");
      }
      setDeletingId(null);
    });
  }

  if (roles.length === 0) {
    return (
      <div className="ca-empty">
        No roles yet. <Link href="/admin/casting/roles/new" className="ca-link">Create the first role</Link>.
      </div>
    );
  }

  return (
    <div>
      {deleteError && <p className="ca-field-error ca-field-error--banner">{deleteError}</p>}
      <div className="ca-roles-list">
        {roles.map((role) => (
          <div key={role.id} className="ca-role-row">
            <div className="ca-role-row-info">
              <div className="ca-role-row-title">
                {role.title}
                <span className={`ca-pill ca-pill--sm ${role.isOpen ? "ca-pill--good" : "ca-pill--muted"}`}>
                  {role.isOpen ? "Open" : "Closed"}
                </span>
              </div>
              <div className="ca-role-row-meta">
                {role.slug} · {role._count.applications} application{role._count.applications !== 1 ? "s" : ""} · Score threshold: {role.minAgentScore}
              </div>
            </div>
            <div className="ca-role-row-actions">
              <Link href={`/admin/casting/roles/${role.id}`} className="ca-btn ca-btn--xs ca-btn--outline">Edit</Link>
              {role._count.applications === 0 && (
                <button
                  className="ca-btn ca-btn--xs ca-btn--danger"
                  onClick={() => handleDelete(role.id)}
                  disabled={isPending && deletingId === role.id}
                >
                  {deletingId === role.id ? "…" : "Delete"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
