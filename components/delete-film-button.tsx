"use client";
import { deleteFilm } from "@/lib/actions/films";
import { Trash2 } from "lucide-react";

export function DeleteFilmButton({ id, title }: { id: string; title: string }) {
  return (
    <form
      action={deleteFilm.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm(`Delete "${title}"?`)) e.preventDefault();
      }}
    >
      <button type="submit" className="action-btn action-btn--danger" title="Delete">
        <Trash2 size={14} />
      </button>
    </form>
  );
}
