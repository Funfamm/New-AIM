import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getRowById } from "@/lib/actions/rows";
import { prisma } from "@/lib/prisma";
import RowEditForm from "@/components/admin/row-edit-form";
import "./row-edit.css";

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

  // Get all published works for the work picker
  const availableWorks = await prisma.work.findMany({
    where: { status: "PUBLISHED", type: { not: "EPISODE" } },
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      posterUrl: true,
    },
    orderBy: { order: "asc" },
  });

  // Ensure posterUrl is included in selection
  type AvailableWork = typeof availableWorks[0];

  // Get work IDs already in this row
  const workIdInRow = new Set(row.items.map((item) => item.workId));

  // Filter to works not in row
  const worksToadd = availableWorks.filter((work) => !workIdInRow.has(work.id));

  return (
    <main className="admin-main">
      <div className="admin-container">
        {/* Header */}
        <div className="admin-header">
          <div className="flex items-center gap-3">
            <Link href="/admin/rows" className="icon-btn" title="Back">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="admin-title">Edit Row: {row.title}</h1>
              <p className="admin-subtitle">Manage row settings and works</p>
            </div>
          </div>
        </div>

        <div className="row-edit-grid">
          {/* Left: Row metadata form */}
          <div className="row-edit-section">
            <h2 className="section-title">Row Settings</h2>
            <RowEditForm row={row} />
          </div>

          {/* Right: Works management */}
          <div className="row-edit-section">
            <h2 className="section-title">Projects in Row</h2>

            {row.items.length === 0 ? (
              <p className="text-muted text-sm">No projects yet</p>
            ) : (
              <div className="row-works-list">
                {row.items.map((item) => (
                  <div key={item.id} className="row-work-item">
                    {item.work.posterUrl && (
                      <img
                        src={item.work.posterUrl}
                        alt={item.work.title}
                        className="work-poster"
                      />
                    )}
                    <div className="work-info">
                      <h3>{item.work.title}</h3>
                      <p className="text-muted text-sm">{item.work.type}</p>
                    </div>
                    <div className="work-controls">
                      <label>
                        Order:
                        <input
                          type="number"
                          defaultValue={item.sortOrder}
                          data-item-id={item.id}
                          data-work-id={item.workId}
                          className="order-input"
                        />
                      </label>
                      <form
                        action={async () => {
                          "use server";
                          const { removeWorkFromRow } = await import(
                            "@/lib/actions/rows"
                          );
                          await removeWorkFromRow(row.id, item.workId);
                        }}
                        style={{ display: "inline" }}
                      >
                        <button type="submit" className="btn btn-sm btn-danger">
                          Remove
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Save order button */}
            {row.items.length > 0 && (
              <form
                action={async (formData) => {
                  "use server";
                  const { updateRowItemOrder } = await import(
                    "@/lib/actions/rows"
                  );
                  const inputs = Array.from(
                    document.querySelectorAll(
                      ".order-input"
                    ) as NodeListOf<HTMLInputElement>
                  );
                  const items = inputs.map((input) => ({
                    workId: input.dataset.workId!,
                    sortOrder: parseInt(input.value, 10) || 0,
                  }));
                  await updateRowItemOrder(row.id, items);
                }}
                style={{ marginTop: "1rem" }}
              >
                <button type="submit" className="btn btn-primary btn-sm">
                  Save Order
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Add Works Section */}
        {worksToadd.length > 0 && (
          <div className="row-edit-section">
            <h2 className="section-title">Add Projects to Row</h2>
            <div className="works-add-list">
              {worksToadd.map((work) => (
                <div key={work.id} className="work-add-item">
                  {work.posterUrl && (
                    <img
                      src={work.posterUrl}
                      alt={work.title}
                      className="work-poster-sm"
                    />
                  )}
                  <div>
                    <h4>{work.title}</h4>
                    <p className="text-muted text-sm">{work.type}</p>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      const { addWorkToRow } = await import(
                        "@/lib/actions/rows"
                      );
                      await addWorkToRow(row.id, work.id);
                    }}
                    style={{ marginLeft: "auto" }}
                  >
                    <button type="submit" className="btn btn-sm btn-secondary">
                      Add
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
