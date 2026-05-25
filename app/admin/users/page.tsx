// Admin Users — command center
// Server-rendered. Pagination, search, role filter, login-method filter.
// Client components only for search debounce, role selector, and reset-email button.

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { UsersFilters } from "./users-filters";
import { UserRoleForm } from "./user-role-form";
import { UserResetBtn } from "./user-reset-btn";
import "./users.css";

export const metadata: Metadata = { title: "Admin — Users" };

const PAGE_SIZE = 25;

// ── Build Prisma where clause from URL params ─────────────────
function buildWhere(
  q: string,
  role: string,
  via: string
): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (q.trim()) {
    where.OR = [
      { name: { contains: q.trim(), mode: "insensitive" } },
      { email: { contains: q.trim(), mode: "insensitive" } },
    ];
  }

  if (role === "ADMIN") where.role = "ADMIN";
  if (role === "USER")  where.role = "USER";

  if (via === "google") {
    where.accounts = { some: { provider: "google" } };
    where.password  = null;
  }
  if (via === "email") {
    where.password  = { not: null };
    where.accounts  = { none: { provider: "google" } };
  }
  if (via === "multi") {
    where.password  = { not: null };
    where.accounts  = { some: { provider: "google" } };
  }

  return where;
}

// ── Pagination URL builder ────────────────────────────────────
function pageUrl(
  p: number,
  q: string,
  role: string,
  via: string,
  sort: string
): string {
  const sp = new URLSearchParams();
  if (q)           sp.set("q",    q);
  if (role)        sp.set("role", role);
  if (via)         sp.set("via",  via);
  if (sort !== "newest") sp.set("sort", sort);
  if (p > 1)       sp.set("page", String(p));
  const qs = sp.toString();
  return `/admin/users${qs ? `?${qs}` : ""}`;
}

// ── Login method helper ───────────────────────────────────────
function loginMethod(hasPassword: boolean, providers: string[]): "google" | "email" | "multi" {
  const hasGoogle = providers.includes("google");
  if (hasGoogle && hasPassword) return "multi";
  if (hasGoogle)                return "google";
  return "email";
}

// ── Page ──────────────────────────────────────────────────────
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const [session, sp] = await Promise.all([auth(), searchParams]);
  const actorId = session?.user?.id ?? "";

  const q    = sp.q    ?? "";
  const role = sp.role ?? "";
  const via  = sp.via  ?? "";
  const sort = sp.sort ?? "newest";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const where = buildWhere(q, role, via);

  const [
    totalCount,
    adminCount,
    googleCount,    // Google-linked (regardless of password)
    credCount,      // has password (regardless of Google)
    multiCount,     // has both
    newThisMonth,
    filteredTotal,
    users,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { accounts: { some: { provider: "google" } } } }),
    prisma.user.count({ where: { password: { not: null } } }),
    prisma.user.count({ where: { password: { not: null }, accounts: { some: { provider: "google" } } } }),
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        password: true,      // checked as boolean server-side only — hash never sent to client
        emailVerified: true,
        createdAt: true,
        accounts:  { select: { provider: true } },
        _count:    { select: { savedWorks: true, progress: true } },
      },
    }),
  ]);

  const memberCount = totalCount - adminCount;
  const totalPages  = Math.ceil(filteredTotal / PAGE_SIZE);
  const isFiltered  = !!(q || role || via);

  return (
    <div className="admin-page">

      {/* ── Header ── */}
      <div className="admin-page-header">
        <h1 className="admin-page-title">Users</h1>
        <span className="upage-count">
          {isFiltered
            ? `${filteredTotal} of ${totalCount}`
            : `${totalCount} total`}
        </span>
      </div>

      {/* ── Stat cards ── */}
      <div className="ustat-row">
        <div className="ustat-cell">
          <div className="ustat-val">{totalCount.toLocaleString()}</div>
          <div className="ustat-lbl">Total Users</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val">{memberCount.toLocaleString()}</div>
          <div className="ustat-lbl">Members</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val ustat-val--accent">{adminCount.toLocaleString()}</div>
          <div className="ustat-lbl">Admins</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val">{googleCount.toLocaleString()}</div>
          <div className="ustat-lbl">Google Sign-in</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val">{credCount.toLocaleString()}</div>
          <div className="ustat-lbl">Email Sign-in</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val">{multiCount.toLocaleString()}</div>
          <div className="ustat-lbl">Multi-auth</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val ustat-val--green">{newThisMonth.toLocaleString()}</div>
          <div className="ustat-lbl">Joined This Month</div>
        </div>
      </div>

      {/* ── Filters ── */}
      <UsersFilters q={q} role={role} via={via} sort={sort} />

      {/* ── Table ── */}
      <div className="admin-table-wrap" style={{ marginTop: "0.75rem" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Via</th>
              <th style={{ textAlign: "center" }}>Saved</th>
              <th style={{ textAlign: "center" }}>Progress</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const providers = u.accounts.map((a) => a.provider);
              const hasPassword = !!u.password;
              const method = loginMethod(hasPassword, providers);
              const isSelf = u.id === actorId;

              return (
                <tr key={u.id} className={isSelf ? "urow--self" : undefined}>
                  {/* Name + email */}
                  <td>
                    <div className="ucell-name">
                      {u.name ?? <span className="ucell-anon">No name</span>}
                      {isSelf && <span className="uself-tag">you</span>}
                    </div>
                    <div className="ucell-email">{u.email}</div>
                  </td>

                  {/* Role — inline change dropdown */}
                  <td>
                    <UserRoleForm
                      userId={u.id}
                      currentRole={u.role}
                      isSelf={isSelf}
                    />
                  </td>

                  {/* Login method badge */}
                  <td>
                    <span className={`uvia-badge uvia-badge--${method}`}>
                      {method === "google" ? "Google"
                       : method === "email" ? "Email"
                       : "Multi"}
                    </span>
                  </td>

                  {/* Saved works */}
                  <td style={{ textAlign: "center" }}>
                    <span className="ucell-count">{u._count.savedWorks}</span>
                  </td>

                  {/* Watch progress */}
                  <td style={{ textAlign: "center" }}>
                    <span className="ucell-count">{u._count.progress}</span>
                  </td>

                  {/* Joined date */}
                  <td className="ucell-date">
                    {new Date(u.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </td>

                  {/* Actions */}
                  <td>
                    <div className="action-btns">
                      {hasPassword && <UserResetBtn userId={u.id} />}
                    </div>
                  </td>
                </tr>
              );
            })}

            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="table-empty">
                  {isFiltered ? "No users match your filters." : "No users yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="upagination">
          {page > 1 ? (
            <Link href={pageUrl(page - 1, q, role, via, sort)} className="upag-btn">
              ← Prev
            </Link>
          ) : (
            <span className="upag-btn upag-btn--disabled">← Prev</span>
          )}
          <span className="upag-info">
            Page {page} of {totalPages}
            {isFiltered && <span className="upag-sub"> · {filteredTotal} matching</span>}
          </span>
          {page < totalPages ? (
            <Link href={pageUrl(page + 1, q, role, via, sort)} className="upag-btn">
              Next →
            </Link>
          ) : (
            <span className="upag-btn upag-btn--disabled">Next →</span>
          )}
        </div>
      )}

    </div>
  );
}
