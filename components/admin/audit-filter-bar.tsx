"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { PremiumSelect } from "./premium-select";

interface Option { value: string; label: string; }

interface Props {
  action: string;
  total: number;
  actionOptions: Option[];
}

export default function AuditFilterBar({ action, total, actionOptions }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams();
    const merged = { action, ...updates };
    if (merged.action) params.set("action", merged.action);
    const qs = params.toString();
    startTransition(() => { router.push(qs ? `${pathname}?${qs}` : pathname); });
  }

  return (
    <div className="admin-filter-bar">
      <PremiumSelect
        name="action"
        defaultValue={action}
        onChange={(v) => navigate({ action: v })}
        placeholder="All Actions"
        options={actionOptions}
      />
      {action && (
        <button
          type="button"
          className="admin-filter-clear"
          onClick={() => navigate({ action: "" })}
        >
          Clear filter
        </button>
      )}
      <span className="admin-filter-count">{total.toLocaleString()} entries</span>
    </div>
  );
}
