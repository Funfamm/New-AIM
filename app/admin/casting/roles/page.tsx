import { adminGetRoles, adminDeleteRole } from "@/lib/actions/casting";
import { requireAdmin } from "@/lib/auth-guard";
import Link from "next/link";
import type { Metadata } from "next";
import RolesClient from "./roles-client";
import "../casting-admin.css";

export const metadata: Metadata = { title: "Admin — Casting Roles" };

export default async function AdminCastingRolesPage() {
  await requireAdmin();
  const roles = await adminGetRoles();

  return (
    <div className="ca-page">
      <div className="ca-header">
        <div className="ca-header-left">
          <Link href="/admin/casting" className="ca-back-link">← Applications</Link>
          <h1 className="ca-title">Casting Roles</h1>
          <p className="ca-subtitle">{roles.length} role{roles.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="ca-header-actions">
          <Link href="/admin/casting/roles/new" className="ca-btn ca-btn--primary">New Role</Link>
        </div>
      </div>

      <RolesClient roles={roles} />
    </div>
  );
}
