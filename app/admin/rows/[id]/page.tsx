import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ImageOff } from "lucide-react";
import type { Metadata } from "next";
import { getRowById, removeWorkFromRow, addWorkToRow } from "@/lib/actions/rows";
import { prisma } from "@/lib/prisma";
import RowEditForm from "@/components/admin/row-edit-form";
import RowItemOrderForm from "@/components/admin/row-item-order-form";
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

  const availableWorks = await prisma.work.findMany({
    where: { status: "PUBLISHED", type: { not: "EPISODE" } },
    select: { id: true, slug: true, title: true, type: true, posterUrl: true },
    orderBy: { order: "asc" },
  });

  const workIdInRow = new Set(row.items.map((item) => item.workId));
  const worksToAdd = availableWorks.filter((w) => !workIdInRow.has(w.id));

  return (
    <div className="rows-page">
      {/* Header */}
      <div className="rows-head">
        <div className="rows-head-title">
          <Link href="/admin/rows" style={{ display: "inline-flex", alignItems: "center", color: "var(--color-brand-muted)", marginRight: "0.5rem" }}>
            <ArrowLeft size={16} />
          </Link>
          <h1>{row.title}</h1>
        </div>
        <p className="rows-head-sub">Edit row settings and manage projects inside it.</p>
      </div>

      <div className="rows-edit-grid">
        {/* Left: Settings form */}
        <div className="rows-section">
          <p className="rows-section-title">Row Settings</p>
          <RowEditForm row={row} />
        </div>

        {/* Right: Works in this row */}
        <div className="rows-section">
          <p className="rows-section-title">
            Projects in row
            {row.items.length > 0 && <span style={{ color: "var(--color-brand-light)", marginLeft: "0.4rem" }}>({row.items.length})</span>}
          </p>

          {row.items.length === 0 ? (
            <p style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem", margin: 0 }}>
              No projects yet — add some below.
            </p>
          ) : (
            <RowItemOrderForm rowId={row.id} items={row.items} />
          )}
        </div>
      </div>

      {/* Add works */}
      {worksToAdd.length > 0 && (
        <div className="rows-section" style={{ marginTop: "1.5rem" }}>
          <p className="rows-section-title">Add projects</p>
          <div className="rows-add-list">
            {worksToAdd.map((work) => (
              <div key={work.id} className="rows-add-item">
                {work.posterUrl ? (
                  <img src={work.posterUrl} alt={work.title} className="rows-add-poster" />
                ) : (
                  <div className="rows-add-poster-placeholder" />
                )}
                <div className="rows-add-info">
                  <div className="rows-add-title">{work.title}</div>
                  <div className="rows-add-type">{work.type.replace(/_/g, " ")}</div>
                </div>
                <form action={async () => {
                  "use server";
                  await addWorkToRow(row.id, work.id);
                }}>
                  <button type="submit" className="btn-secondary btn-sm">Add</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
