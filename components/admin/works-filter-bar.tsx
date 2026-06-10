"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search } from "lucide-react";
import { PremiumSelect } from "@/components/admin/premium-select";

interface Option { value: string; label: string; }

interface Props {
  search: string;
  typeFilter: string;
  statusFilter: string;
  typeOptions: Option[];
  statusOptions: Option[];
  resultCount: number;
  isFiltered: boolean;
}

export default function WorksFilterBar({
  search, typeFilter, statusFilter,
  typeOptions, statusOptions,
  resultCount, isFiltered,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const push = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams();
      const merged = { search, type: typeFilter, status: statusFilter, ...updates };
      if (merged.search)  params.set("search",  merged.search);
      if (merged.type)    params.set("type",    merged.type);
      if (merged.status)  params.set("status",  merged.status);
      const qs = params.toString();
      startTransition(() => { router.push(qs ? `${pathname}?${qs}` : pathname); });
    },
    [search, typeFilter, statusFilter, pathname, router],
  );

  return (
    <div className="admin-filter-bar">
      <div className="admin-filter-search-wrap">
        <Search size={14} />
        <input
          type="text"
          className="admin-filter-search"
          placeholder="Search by title…"
          defaultValue={search}
          onChange={(e) => push({ search: e.target.value })}
        />
      </div>

      <PremiumSelect
        key={typeFilter}
        name="type"
        defaultValue={typeFilter}
        options={typeOptions}
        placeholder="All types"
        onChange={(value) => push({ type: value })}
      />

      <PremiumSelect
        key={statusFilter}
        name="status"
        defaultValue={statusFilter}
        options={statusOptions}
        placeholder="All statuses"
        onChange={(value) => push({ status: value })}
      />

      {isFiltered && (
        <button
          type="button"
          className="admin-filter-clear"
          onClick={() => startTransition(() => router.push(pathname))}
        >
          Clear filters
        </button>
      )}

      <span className="admin-filter-count">{resultCount} result{resultCount !== 1 ? "s" : ""}</span>
    </div>
  );
}
