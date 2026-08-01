"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";
import { PremiumSelect } from "./premium-select";

interface Option { value: string; label: string; }

interface Props {
  typeFilter: string;
  search: string;
  typeOptions: Option[];
  isFiltered: boolean;
  resultCount: number;
}

export default function EngagementFilterBar({
  typeFilter, search, typeOptions, isFiltered, resultCount,
}: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  function navigate(updates: Record<string, string>) {
    const merged = { type: typeFilter, search, ...updates };
    const params = new URLSearchParams();
    if (merged.type)   params.set("type",   merged.type);
    if (merged.search) params.set("search", merged.search);
    const qs = params.toString();
    startTransition(() => { router.push(qs ? `${pathname}?${qs}` : pathname); });
  }

  return (
    <div className="admin-filter-bar">
      <div className="admin-filter-search-wrap">
        <Search size={14} />
        <input
          type="text"
          className="admin-filter-search"
          placeholder="Search user name or email…"
          defaultValue={search}
          onChange={(e) => navigate({ search: e.target.value })}
        />
      </div>

      <PremiumSelect
        name="type"
        defaultValue={typeFilter}
        onChange={(v) => navigate({ type: v })}
        placeholder="All types"
        options={typeOptions}
      />

      {isFiltered && (
        <button
          type="button"
          className="admin-filter-clear"
          onClick={() => startTransition(() => router.push(pathname))}
        >
          Clear
        </button>
      )}

      <span className="admin-filter-count">{resultCount} result{resultCount !== 1 ? "s" : ""}</span>
    </div>
  );
}
