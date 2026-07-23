import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getRowById } from "@/lib/actions/rows";
import RowEditForm from "@/components/admin/row-edit-form";
import "../rows.css";

export const metadata: Metadata = { title: "Admin — Edit Row" };

type Props = {
  params: Promise<{ id: string }>;
};

export default async function RowEditPage({ params }: Props) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) redirect("/login");

  const { id } = await params;
  const row = await getRowById(id);
  if (!row) notFound();

  return (
    <div className="rows-page">
      <div className="rows-head">
        <div className="rows-head-title">
          <Link href="/admin/rows" style={{ display: "inline-flex", alignItems: "center", color: "var(--color-brand-muted)", marginRight: "0.5rem" }}>
            <ArrowLeft size={16} />
          </Link>
          <h1>{row.title}</h1>
        </div>
        <p className="rows-head-sub">Edit row settings.</p>
      </div>

      <div className="rows-edit-grid">
        {/* Left: Settings */}
        <div className="rows-section">
          <p className="rows-section-title">Row Settings</p>
          <RowEditForm row={row} />
        </div>

        {/* Right: Read-only project list */}
        <div className="rows-section">
          <p className="rows-section-title">
            Projects assigned to this row
            {row.items.length > 0 && (
              <span style={{ color: "var(--color-brand-light)", marginLeft: "0.4rem" }}>
                ({row.items.length})
              </span>
            )}
          </p>

          {row.items.length === 0 ? (
            <p style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem", margin: 0 }}>
              No projects assigned yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {row.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.75rem",
                    padding: "0.5rem", background: "var(--color-brand-surface)", borderRadius: 4,
                  }}
                >
                  {item.work.posterUrl ? (
                    <img
                      src={item.work.posterUrl}
                      alt={item.work.title}
                      style={{ width: 32, height: 48, objectFit: "cover", borderRadius: 2, flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{ width: 32, height: 48, background: "var(--color-brand-border)", borderRadius: 2, flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-brand-light)", fontWeight: 500 }}>
                      {item.work.title}
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-brand-muted)" }}>
                      {item.work.type.replace(/_/g, " ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-brand-muted)", marginTop: "0.75rem" }}>
            To assign or remove projects, open the project&rsquo;s edit page.
          </p>
        </div>
      </div>
    </div>
  );
}
