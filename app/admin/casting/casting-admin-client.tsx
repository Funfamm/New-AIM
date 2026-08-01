"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminGetApplications, adminExportCastingCSV } from "@/lib/actions/casting";
import type { ApplicationFilter } from "@/lib/actions/casting";

type Application = Awaited<ReturnType<typeof adminGetApplications>>[number];
type Role = { id: string; title: string };

const STATUS_OPTS = [
  { value: "ALL",                   label: "All Statuses" },
  { value: "SUBMITTED",             label: "Received" },
  { value: "UNDER_AGENT_REVIEW",    label: "Under Review" },
  { value: "REQUIREMENTS_NOT_MET",  label: "Action Required" },
  { value: "READY_FOR_ADMIN_REVIEW",label: "Ready for Review" },
  { value: "SHORTLISTED",           label: "Shortlisted" },
  { value: "CONTACTED",             label: "Contacted" },
  { value: "SELECTED",              label: "Selected" },
  { value: "NOT_SELECTED",          label: "Not Selected" },
  { value: "WITHDRAWN",             label: "Withdrawn" },
];

const REC_OPTS = [
  { value: "ALL",           label: "All Recommendations" },
  { value: "PASS",          label: "Pass" },
  { value: "MANUAL_REVIEW", label: "Manual Review" },
  { value: "FAIL",          label: "Fail" },
];

const STATUS_PILL: Record<string, string> = {
  SUBMITTED:              "ca-pill--neutral",
  UNDER_AGENT_REVIEW:     "ca-pill--neutral",
  REQUIREMENTS_NOT_MET:   "ca-pill--warn",
  READY_FOR_ADMIN_REVIEW: "ca-pill--info",
  SHORTLISTED:            "ca-pill--good",
  CONTACTED:              "ca-pill--good",
  SELECTED:               "ca-pill--success",
  NOT_SELECTED:           "ca-pill--muted",
  WITHDRAWN:              "ca-pill--muted",
};

const STATUS_DISPLAY: Record<string, string> = {
  SUBMITTED:              "Received",
  UNDER_AGENT_REVIEW:     "Under Review",
  REQUIREMENTS_NOT_MET:   "Action Required",
  READY_FOR_ADMIN_REVIEW: "Ready",
  SHORTLISTED:            "Shortlisted",
  CONTACTED:              "Contacted",
  SELECTED:               "Selected",
  NOT_SELECTED:           "Not Selected",
  WITHDRAWN:              "Withdrawn",
};

const REC_PILL: Record<string, string> = {
  PASS:          "ca-rec--pass",
  MANUAL_REVIEW: "ca-rec--manual",
  FAIL:          "ca-rec--fail",
};

export default function CastingAdminClient({
  initialApplications,
  roles,
  initialFilter,
}: {
  initialApplications: Application[];
  roles: Role[];
  initialFilter: ApplicationFilter;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [applications, setApplications] = useState(initialApplications);
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState(initialFilter.search ?? "");
  const [exporting, setExporting] = useState(false);

  function applyFilter(next: ApplicationFilter) {
    setFilter(next);
    startTransition(async () => {
      const results = await adminGetApplications(next);
      setApplications(results);
    });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    applyFilter({ ...filter, search: search.trim() || undefined });
  }

  async function handleExport() {
    setExporting(true);
    const csv = await adminExportCastingCSV(filter);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `casting-applications-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  return (
    <div>
      {/* Filters */}
      <div className="ca-filters">
        <form onSubmit={handleSearch} className="ca-search-row">
          <input
            className="ca-search-input"
            type="text"
            placeholder="Search name, email, handle…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="ca-btn ca-btn--primary">Search</button>
        </form>

        <div className="ca-filter-row">
          <select
            className="ca-select"
            value={filter.status ?? "ALL"}
            onChange={(e) => applyFilter({ ...filter, status: e.target.value === "ALL" ? undefined : e.target.value })}
          >
            {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select
            className="ca-select"
            value={filter.roleId ?? "ALL"}
            onChange={(e) => applyFilter({ ...filter, roleId: e.target.value === "ALL" ? undefined : e.target.value })}
          >
            <option value="ALL">All Roles</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>

          <select
            className="ca-select"
            value={filter.recommendation ?? "ALL"}
            onChange={(e) => applyFilter({ ...filter, recommendation: e.target.value === "ALL" ? undefined : e.target.value })}
          >
            {REC_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <button
            className="ca-btn ca-btn--ghost"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      {/* Table */}
      {isPending ? (
        <div className="ca-loading">Loading…</div>
      ) : applications.length === 0 ? (
        <div className="ca-empty">No applications match the current filters.</div>
      ) : (
        <div className="ca-table-wrap">
          <table className="ca-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Role</th>
                <th>Status</th>
                <th>Score</th>
                <th>Rec.</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td>
                    <div className="ca-table-name">{app.name}</div>
                    <div className="ca-table-email">{app.email}</div>
                  </td>
                  <td className="ca-table-role">{app.role.title}</td>
                  <td>
                    <span className={`ca-pill ${STATUS_PILL[app.status] ?? ""}`}>
                      {STATUS_DISPLAY[app.status] ?? app.status}
                    </span>
                  </td>
                  <td className="ca-table-score">
                    {app.agentReview ? (
                      <span className="ca-score">{app.agentReview.overallScore}</span>
                    ) : (
                      <span className="ca-score-none">—</span>
                    )}
                  </td>
                  <td>
                    {app.agentReview?.recommendation && (
                      <span className={`ca-rec ${REC_PILL[app.agentReview.recommendation] ?? ""}`}>
                        {app.agentReview.recommendation.replace("_", " ")}
                      </span>
                    )}
                  </td>
                  <td className="ca-table-date">
                    {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "2-digit" }).format(new Date(app.createdAt))}
                  </td>
                  <td>
                    <Link href={`/admin/casting/${app.id}`} className="ca-btn ca-btn--xs ca-btn--outline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
