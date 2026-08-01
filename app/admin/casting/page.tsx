import { adminGetApplications, adminGetRoles, adminExportCastingCSV } from "@/lib/actions/casting";
import { requireAdmin } from "@/lib/auth-guard";
import Link from "next/link";
import type { Metadata } from "next";
import CastingAdminClient from "./casting-admin-client";
import "./casting-admin.css";

export const metadata: Metadata = { title: "Admin — Casting" };

type SearchParams = {
  status?:         string;
  roleId?:         string;
  recommendation?: string;
  search?:         string;
};

export default async function AdminCastingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const filter = {
    status:         sp.status || undefined,
    roleId:         sp.roleId || undefined,
    recommendation: sp.recommendation || undefined,
    search:         sp.search || undefined,
  };

  const [applications, roles] = await Promise.all([
    adminGetApplications(filter),
    adminGetRoles(),
  ]);

  return (
    <div className="ca-page">
      <div className="ca-header">
        <div className="ca-header-left">
          <h1 className="ca-title">Casting</h1>
          <p className="ca-subtitle">{applications.length} application{applications.length !== 1 ? "s" : ""} found</p>
        </div>
        <div className="ca-header-actions">
          <Link href="/admin/casting/roles" className="ca-btn ca-btn--outline">Manage Roles</Link>
        </div>
      </div>

      <CastingAdminClient
        initialApplications={applications}
        roles={roles.map((r) => ({ id: r.id, title: r.title }))}
        initialFilter={filter}
      />
    </div>
  );
}
