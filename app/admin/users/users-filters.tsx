"use client";

import { useRef } from "react";
import { PremiumSelect } from "@/components/admin/premium-select";

interface Props {
  q: string;
  role: string;
  via: string;
  sort: string;
  status: string;
}

export function UsersFilters({ q, role, via, sort, status }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  function submit() {
    formRef.current?.requestSubmit();
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  function debouncedSubmit() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(submit, 380);
  }

  return (
    <form ref={formRef} method="get" action="/admin/users" className="admin-filter-bar ufilters">
      <div className="admin-filter-search-wrap">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          name="q"
          type="search"
          defaultValue={q}
          onChange={debouncedSubmit}
          placeholder="Search name or email…"
          className="admin-filter-search"
          autoComplete="off"
        />
      </div>

      <PremiumSelect
        name="role"
        defaultValue={role}
        onChange={submit}
        placeholder="All Roles"
        options={[
          { value: "ADMIN", label: "Admin" },
          { value: "USER",  label: "Member" },
        ]}
      />

      <PremiumSelect
        name="via"
        defaultValue={via}
        onChange={submit}
        placeholder="All Methods"
        options={[
          { value: "google", label: "Google" },
          { value: "email",  label: "Email / Password" },
          { value: "multi",  label: "Multi" },
        ]}
      />

      <PremiumSelect
        name="status"
        defaultValue={status}
        onChange={submit}
        placeholder="All Statuses"
        options={[
          { value: "ACTIVE",      label: "Active" },
          { value: "SUSPENDED",   label: "Suspended" },
          { value: "DEACTIVATED", label: "Deactivated" },
        ]}
      />

      <PremiumSelect
        name="sort"
        defaultValue={sort}
        onChange={submit}
        placeholder="Newest First"
        options={[
          { value: "newest", label: "Newest First" },
          { value: "oldest", label: "Oldest First" },
        ]}
      />

      {(q || role || via || status || sort === "oldest") && (
        <a href="/admin/users" className="admin-filter-clear">Clear</a>
      )}
    </form>
  );
}
