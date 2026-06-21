"use client";

import { useState, useTransition } from "react";
import { removeWorkFromRow, updateRowItemOrder } from "@/lib/actions/rows";

type Item = {
  id: string;
  workId: string;
  sortOrder: number;
  work: {
    id: string;
    title: string;
    type: string;
    slug: string;
    posterUrl: string | null;
  };
};

export default function RowItemOrderForm({ rowId, items: initial }: { rowId: string; items: Item[] }) {
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const setOrder = (workId: string, value: string) => {
    setSaved(false);
    setItems((prev) =>
      prev.map((item) =>
        item.workId === workId ? { ...item, sortOrder: parseInt(value, 10) || 0 } : item
      )
    );
  };

  const saveOrder = () => {
    startTransition(async () => {
      await updateRowItemOrder(
        rowId,
        items.map((item) => ({ workId: item.workId, sortOrder: item.sortOrder }))
      );
      setSaved(true);
    });
  };

  const remove = (workId: string) => {
    startTransition(async () => {
      await removeWorkFromRow(rowId, workId);
      setItems((prev) => prev.filter((item) => item.workId !== workId));
    });
  };

  return (
    <div>
      <div className="rows-works-list">
        {items.map((item) => (
          <div key={item.id} className="rows-work-item">
            {item.work.posterUrl ? (
              <img src={item.work.posterUrl} alt={item.work.title} className="rows-work-poster" />
            ) : (
              <div className="rows-work-poster-placeholder" />
            )}
            <div className="rows-work-info">
              <div className="rows-work-title">{item.work.title}</div>
              <div className="rows-work-type">{item.work.type.replace(/_/g, " ")}</div>
            </div>
            <div className="rows-work-controls">
              <input
                type="number"
                value={item.sortOrder}
                onChange={(e) => setOrder(item.workId, e.target.value)}
                className="rows-order-input"
                aria-label="Sort order"
              />
              <button
                type="button"
                className="btn-danger btn-sm"
                onClick={() => remove(item.workId)}
                disabled={pending}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={saveOrder}
          disabled={pending}
        >
          {pending ? "Saving…" : "Save order"}
        </button>
        {saved && !pending && (
          <span style={{ fontSize: "0.75rem", color: "#86efac" }}>Saved</span>
        )}
      </div>
    </div>
  );
}
