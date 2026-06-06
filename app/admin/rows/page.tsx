import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Layers, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import type { Metadata } from "next";
import { getRows, setRowActive, deleteRow } from "@/lib/actions/rows";
import RowCreateForm from "@/components/admin/row-create-form";
import "./rows.css";

export const metadata: Metadata = { title: "Admin — Rows & Collections" };

export default async function RowsPage() {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) redirect("/login");

  const rows = await getRows();

  return (
    <div className="rows-page">
      {/* Header */}
      <div className="rows-head">
        <div className="rows-head-title">
          <Layers size={18} />
          <h1>Rows &amp; Collections</h1>
        </div>
        <p className="rows-head-sub">
          Create custom project rows for the homepage and works page.
        </p>
      </div>

      {/* Quick create */}
      <div className="rows-create-card">
        <p className="rows-create-label">New row</p>
        <RowCreateForm />
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rows-empty">
          <Layers size={32} strokeWidth={1.2} />
          <p>No custom rows yet. Create your first row above.</p>
        </div>
      ) : (
        <div className="rows-table-wrap">
          <table className="rows-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Placement</th>
                <th className="col-center">Works</th>
                <th className="col-center">Order</th>
                <th className="col-center">Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="rows-title-cell">
                      <span className="rows-title">{row.title}</span>
                      <span className="rows-slug">{row.slug}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`rows-placement rows-placement--${row.placement.toLowerCase()}`}>
                      {row.placement === "BOTH" ? "Home & Works" : row.placement === "HOME" ? "Home" : "Works"}
                    </span>
                  </td>
                  <td className="col-center rows-num">{row.itemCount}</td>
                  <td className="col-center rows-num">{row.sortOrder}</td>
                  <td className="col-center">
                    <form action={async () => {
                      "use server";
                      await setRowActive(row.id, !row.active);
                    }}>
                      <button type="submit" className="rows-toggle" title={row.active ? "Deactivate" : "Activate"}>
                        {row.active
                          ? <Eye size={15} className="icon-active" />
                          : <EyeOff size={15} className="icon-inactive" />}
                      </button>
                    </form>
                  </td>
                  <td>
                    <div className="rows-actions">
                      <Link href={`/admin/rows/${row.id}`} className="rows-edit-btn" title="Edit row">
                        <Pencil size={13} />
                        Edit
                      </Link>
                      <form action={async () => {
                        "use server";
                        await deleteRow(row.id);
                      }} style={{ display: "inline" }}>
                        <button
                          type="submit"
                          className="rows-delete-btn"
                          title={`Delete "${row.title}"`}
                          formAction={async () => {
                            "use server";
                            await deleteRow(row.id);
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </form>
                    </div>
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
