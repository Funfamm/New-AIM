import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import type { Metadata } from "next";
import { getRows, setRowActive, deleteRow } from "@/lib/actions/rows";
import RowCreateForm from "@/components/admin/row-create-form";
import "./rows.css";

export const metadata: Metadata = { title: "Admin — Rows & Collections" };

export default async function RowsPage() {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) redirect("/login");

  const rows = await getRows();

  const handleDeleteRow = async (rowId: string) => {
    "use server";
    await deleteRow(rowId);
  };

  return (
    <main className="admin-main">
      <div className="admin-container">
        {/* Header */}
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Rows & Collections</h1>
            <p className="admin-subtitle">
              Create custom project rows for the homepage and works page.
            </p>
          </div>
          <Link href="/admin/rows/new" className="btn btn-primary">
            <Plus size={16} />
            Create Row
          </Link>
        </div>

        {/* Create Row Form (Inline) */}
        <div className="rows-quick-create">
          <RowCreateForm />
        </div>

        {/* Rows Table */}
        <div className="rows-table-wrapper">
          {rows.length === 0 ? (
            <div className="empty-state">
              <p>No custom rows yet. Create your first row above.</p>
            </div>
          ) : (
            <table className="rows-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Slug</th>
                  <th>Placement</th>
                  <th className="text-center">Works</th>
                  <th className="text-center">Order</th>
                  <th className="text-center">Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">{row.title}</td>
                    <td className="text-muted text-sm">{row.slug}</td>
                    <td>
                      <span className="badge">
                        {row.placement === "BOTH"
                          ? "Home & Works"
                          : row.placement === "HOME"
                          ? "Home"
                          : "Works"}
                      </span>
                    </td>
                    <td className="text-center">{row.itemCount}</td>
                    <td className="text-center text-sm">{row.sortOrder}</td>
                    <td className="text-center">
                      <form action={async () => {
                        "use server";
                        await setRowActive(row.id, !row.active);
                      }}>
                        <button
                          type="submit"
                          className="icon-btn"
                          title={row.active ? "Deactivate" : "Activate"}
                        >
                          {row.active ? (
                            <Eye size={16} className="text-green-500" />
                          ) : (
                            <EyeOff size={16} className="text-muted" />
                          )}
                        </button>
                      </form>
                    </td>
                    <td className="actions-cell">
                      <Link
                        href={`/admin/rows/${row.id}`}
                        className="icon-btn"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </Link>
                      <form action={async () => {
                        "use server";
                        if (
                          confirm(
                            `Delete "${row.title}" and all its items?`
                          )
                        ) {
                          await deleteRow(row.id);
                        }
                      }} style={{ display: "inline" }}>
                        <button
                          type="submit"
                          className="icon-btn text-red-500"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
