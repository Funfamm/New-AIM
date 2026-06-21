"use client";

import { useMemo, useState } from "react";
import {
  Plus, Trash2, RotateCcw, Power, CheckCircle, AlertTriangle,
  Clock, XCircle, Key, Search, Zap, TrendingDown, Languages, Mic,
} from "lucide-react";

type ApiKey = {
  id: string;
  provider: string;
  name: string;
  keyPreview: string | null;
  isEnabled: boolean;
  status: string;
  taskScopes: string[];
  failureCount: number;
  successCount: number;
  lastUsedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  cooldownUntil: string | null;
  errorMessage: string | null;
  windowMaxCalls: number;
  usedInWindow: number;
  windowResetAt: string | null;
  createdAt: string;
};

type FilterStatus = "all" | "healthy" | "near-limit" | "cooldown" | "invalid" | "disabled";
type FilterHealth = "all" | "attention" | "working";
type FilterScope  = "all" | "TRANSLATION" | "CASTING_AUDITION" | "both";
type SortBy       = "newest" | "recently-used" | "most-failures" | "most-successes";
type QuotaStatus  = "ok" | "near" | "full";

type Props = { initialKeys: ApiKey[] };

const SCOPE_LABELS: Record<string, string> = {
  TRANSLATION:      "Translation",
  CASTING_AUDITION: "Audition",
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTimeRemaining(d: string): string {
  const diff = new Date(d).getTime() - Date.now();
  if (diff <= 0) return "soon";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function computeQuotaStatus(k: ApiKey, now: Date): QuotaStatus {
  if (!k.windowResetAt || new Date(k.windowResetAt) <= now) return "ok";
  if (k.windowMaxCalls <= 0) return "ok";
  const pct = k.usedInWindow / k.windowMaxCalls;
  if (pct >= 1)   return "full";
  if (pct >= 0.8) return "near";
  return "ok";
}

function matchesStatus(k: ApiKey, f: FilterStatus, now: Date): boolean {
  if (f === "all")        return true;
  if (f === "disabled")   return !k.isEnabled;
  if (!k.isEnabled)       return false;
  if (f === "invalid")    return k.status === "INVALID";
  if (f === "cooldown")   return k.status === "COOLDOWN" || !!(k.cooldownUntil && new Date(k.cooldownUntil) > now);
  if (f === "near-limit") return computeQuotaStatus(k, now) !== "ok";
  if (f === "healthy")    return (
    k.status === "HEALTHY" &&
    !(k.cooldownUntil && new Date(k.cooldownUntil) > now) &&
    computeQuotaStatus(k, now) === "ok"
  );
  return true;
}

function matchesHealth(k: ApiKey, f: FilterHealth): boolean {
  if (f === "all") return true;
  const now           = new Date();
  const quotaStatus   = computeQuotaStatus(k, now);
  const needsAttention = k.failureCount > 0 || k.status !== "HEALTHY" || !k.isEnabled || quotaStatus !== "ok";
  if (f === "attention") return needsAttention;
  if (f === "working")   return k.isEnabled && k.status === "HEALTHY" && quotaStatus === "ok";
  return true;
}

function matchesScope(k: ApiKey, f: FilterScope): boolean {
  if (f === "all")              return true;
  if (f === "both")             return k.taskScopes.includes("TRANSLATION") && k.taskScopes.includes("CASTING_AUDITION");
  if (f === "TRANSLATION")      return k.taskScopes.includes("TRANSLATION") && !k.taskScopes.includes("CASTING_AUDITION");
  if (f === "CASTING_AUDITION") return k.taskScopes.includes("CASTING_AUDITION") && !k.taskScopes.includes("TRANSLATION");
  return true;
}

function sortKeys(list: ApiKey[], sort: SortBy): ApiKey[] {
  const copy = [...list];
  if (sort === "newest")         return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (sort === "recently-used")  return copy.sort((a, b) => (b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0) - (a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0));
  if (sort === "most-failures")  return copy.sort((a, b) => b.failureCount - a.failureCount);
  if (sort === "most-successes") return copy.sort((a, b) => b.successCount - a.successCount);
  return copy;
}

function scopeLabel(scopes: string[]): string {
  const hasT = scopes.includes("TRANSLATION");
  const hasA = scopes.includes("CASTING_AUDITION");
  if (hasT && hasA) return "Both";
  if (hasA)         return "Audition";
  return "Translation";
}

function ScopeBadge({ scopes }: { scopes: string[] }) {
  const hasT = scopes.includes("TRANSLATION");
  const hasA = scopes.includes("CASTING_AUDITION");
  if (hasT && hasA) return (
    <span className="tk-badge tk-badge--scope-both">
      <Languages size={8} /> <Mic size={8} /> Both
    </span>
  );
  if (hasA) return (
    <span className="tk-badge tk-badge--scope-audition">
      <Mic size={8} /> Audition
    </span>
  );
  return (
    <span className="tk-badge tk-badge--scope-translation">
      <Languages size={8} /> Translation
    </span>
  );
}

function StatusBadge({
  status, isEnabled, quotaStatus,
}: { status: string; isEnabled: boolean; quotaStatus: QuotaStatus }) {
  if (!isEnabled)             return <span className="tk-badge tk-badge--disabled">Disabled</span>;
  if (status === "INVALID")   return <span className="tk-badge tk-badge--invalid"><XCircle size={9} /> Invalid</span>;
  if (status === "COOLDOWN")  return <span className="tk-badge tk-badge--cooldown"><Clock size={9} /> Cooldown</span>;
  if (quotaStatus === "full") return <span className="tk-badge tk-badge--over-quota"><TrendingDown size={9} /> Quota Full</span>;
  if (quotaStatus === "near") return <span className="tk-badge tk-badge--near-limit"><TrendingDown size={9} /> Near Limit</span>;
  if (status === "HEALTHY")   return <span className="tk-badge tk-badge--healthy"><CheckCircle size={9} /> Healthy</span>;
  return <span className="tk-badge tk-badge--disabled">{status}</span>;
}

export default function TranslationKeysClient({ initialKeys }: Props) {
  const [keys, setKeys]                       = useState<ApiKey[]>(initialKeys);
  const [showAdd, setShowAdd]                 = useState(false);
  const [addName, setAddName]                 = useState("");
  const [addKey, setAddKey]                   = useState("");
  const [addScopes, setAddScopes]             = useState<string[]>(["TRANSLATION"]);
  const [adding, setAdding]                   = useState(false);
  const [addError, setAddError]               = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy]                       = useState<string | null>(null);
  const [pageError, setPageError]             = useState<string | null>(null);
  const [pageMsg, setPageMsg]                 = useState<string | null>(null);

  // filter + sort
  const [search, setSearch]                 = useState("");
  const [filterProvider, setFilterProvider] = useState("all");
  const [filterStatus, setFilterStatus]     = useState<FilterStatus>("all");
  const [filterHealth, setFilterHealth]     = useState<FilterHealth>("all");
  const [filterScope, setFilterScope]       = useState<FilterScope>("all");
  const [sortBy, setSortBy]                 = useState<SortBy>("newest");

  // bulk clear
  const [confirmBulkClear, setConfirmBulkClear] = useState(false);
  const [bulkClearing, setBulkClearing]         = useState(false);

  // bulk scope assign
  const [selectedIds, setSelectedIds]                 = useState<Set<string>>(new Set());
  const [bulkScopeTarget, setBulkScopeTarget]         = useState<string[] | null>(null);
  const [confirmBulkScope, setConfirmBulkScope]       = useState(false);
  const [bulkScopeApplying, setBulkScopeApplying]     = useState(false);

  const providers = useMemo(() => [...new Set(keys.map((k) => k.provider))], [keys]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total:      keys.length,
      healthy:    keys.filter((k) =>
        k.isEnabled &&
        k.status === "HEALTHY" &&
        !(k.cooldownUntil && new Date(k.cooldownUntil) > now) &&
        computeQuotaStatus(k, now) === "ok"
      ).length,
      nearLimit:  keys.filter((k) => k.isEnabled && computeQuotaStatus(k, now) !== "ok").length,
      cooldown:   keys.filter((k) => k.isEnabled && (k.status === "COOLDOWN" || !!(k.cooldownUntil && new Date(k.cooldownUntil) > now))).length,
      disabled:   keys.filter((k) => !k.isEnabled).length,
    };
  }, [keys]);

  const needsAttentionCount = useMemo(
    () => {
      const now = new Date();
      return keys.filter((k) =>
        k.failureCount > 0 || k.status !== "HEALTHY" || !k.isEnabled || computeQuotaStatus(k, now) !== "ok"
      ).length;
    },
    [keys],
  );

  // Task availability warnings
  const hasActiveTranslation = useMemo(() => {
    const now = new Date();
    return keys.some((k) =>
      k.isEnabled &&
      k.status !== "INVALID" &&
      k.taskScopes.includes("TRANSLATION") &&
      !(k.cooldownUntil && new Date(k.cooldownUntil) > now) &&
      computeQuotaStatus(k, now) !== "full"
    );
  }, [keys]);

  const hasActiveAudition = useMemo(() => {
    const now = new Date();
    return keys.some((k) =>
      k.isEnabled &&
      k.status !== "INVALID" &&
      k.taskScopes.includes("CASTING_AUDITION") &&
      !(k.cooldownUntil && new Date(k.cooldownUntil) > now) &&
      computeQuotaStatus(k, now) !== "full"
    );
  }, [keys]);

  const filteredKeys = useMemo(() => {
    const now = new Date();
    const q   = search.toLowerCase().trim();
    const filtered = keys.filter((k) => {
      if (q && !k.name.toLowerCase().includes(q) && !(k.keyPreview ?? "").toLowerCase().includes(q)) return false;
      if (filterProvider !== "all" && k.provider !== filterProvider) return false;
      if (!matchesStatus(k, filterStatus, now)) return false;
      if (!matchesHealth(k, filterHealth)) return false;
      if (!matchesScope(k, filterScope)) return false;
      return true;
    });
    return sortKeys(filtered, sortBy);
  }, [keys, search, filterProvider, filterStatus, filterHealth, filterScope, sortBy]);

  const clearableKeys = useMemo(
    () => filteredKeys.filter(
      (k) => k.isEnabled && (
        k.status !== "HEALTHY" ||
        k.failureCount > 0 ||
        k.errorMessage !== null ||
        !!(k.cooldownUntil && new Date(k.cooldownUntil) > new Date())
      ),
    ),
    [filteredKeys],
  );

  const isFiltered = !!(search || filterStatus !== "all" || filterHealth !== "all" || filterProvider !== "all" || filterScope !== "all");

  function flash(msg: string) {
    setPageMsg(msg);
    setTimeout(() => setPageMsg(null), 4000);
  }

  async function refresh() {
    const res = await fetch("/api/admin/translation-keys");
    if (res.ok) {
      const data = await res.json() as { keys: ApiKey[] };
      setKeys(data.keys);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim() || !addKey.trim() || addScopes.length === 0) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/admin/translation-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim(), key: addKey.trim(), taskScopes: addScopes }),
      });
      const data = await res.json() as { error?: string; key?: ApiKey };
      if (!res.ok) { setAddError(data.error ?? "Failed to add key"); return; }
      setShowAdd(false);
      setAddName("");
      setAddKey("");
      setAddScopes(["TRANSLATION"]);
      await refresh();
    } finally {
      setAdding(false);
    }
  }

  async function handleAction(id: string, action: "enable" | "disable" | "reset") {
    setBusy(id + action);
    setPageError(null);
    try {
      const res = await fetch(`/api/admin/translation-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setPageError(d.error ?? "Action failed");
      } else {
        await refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleSetScope(id: string, scopes: string[]) {
    setBusy(id + "scope");
    setPageError(null);
    try {
      const res = await fetch(`/api/admin/translation-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setScope", taskScopes: scopes }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setPageError(d.error ?? "Scope update failed");
      } else {
        await refresh();
        flash(`Scope updated to: ${scopeLabel(scopes)}`);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string) {
    setBusy(id + "delete");
    setPageError(null);
    try {
      const res = await fetch(`/api/admin/translation-keys/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setPageError(d.error ?? "Delete failed");
      } else {
        setConfirmDeleteId(null);
        await refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleBulkClear() {
    if (clearableKeys.length === 0) return;
    setBulkClearing(true);
    setPageError(null);
    try {
      const res = await fetch("/api/admin/translation-keys/bulk-clear", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: clearableKeys.map((k) => k.id) }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setPageError(d.error ?? "Bulk clear failed");
      } else {
        const d = await res.json() as { cleared: number };
        setConfirmBulkClear(false);
        await refresh();
        flash(`Cleared errors for ${d.cleared} key${d.cleared !== 1 ? "s" : ""}.`);
      }
    } finally {
      setBulkClearing(false);
    }
  }

  async function handleBulkScopeApply() {
    if (!bulkScopeTarget || selectedIds.size === 0) return;
    setBulkScopeApplying(true);
    setPageError(null);
    try {
      const res = await fetch("/api/admin/translation-keys/bulk-scope", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds], taskScopes: bulkScopeTarget }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setPageError(d.error ?? "Bulk scope assignment failed");
      } else {
        const d = await res.json() as { updated: number };
        setConfirmBulkScope(false);
        setSelectedIds(new Set());
        setBulkScopeTarget(null);
        await refresh();
        flash(`Scope updated for ${d.updated} key${d.updated !== 1 ? "s" : ""}.`);
      }
    } finally {
      setBulkScopeApplying(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(filteredKeys.map((k) => k.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  return (
    <>
      {/* Header */}
      <div className="tk-heading">
        <div>
          <h1 className="tk-title"><Key size={18} /> AI Keys</h1>
          <p className="tk-title-sub">Manage encrypted Gemini keys. Assign each key to Translation, Casting Audition, or Both.</p>
        </div>
        <button className="tk-btn tk-btn--primary" onClick={() => { setShowAdd((v) => !v); setAddError(null); }}>
          <Plus size={14} />
          Add Key
        </button>
      </div>

      {/* Task availability warnings */}
      {!hasActiveTranslation && (
        <div className="tk-warning">
          <AlertTriangle size={13} />
          No active AI key is assigned to <strong>Translation</strong>. Assign at least one key before translating subtitles.
        </div>
      )}
      {!hasActiveAudition && (
        <div className="tk-warning">
          <AlertTriangle size={13} />
          No active AI key is assigned to <strong>Casting Audition</strong>. Assign at least one key before running casting reviews.
        </div>
      )}

      {/* Stats row */}
      {keys.length > 0 && (
        <div className="tk-stats">
          <div className="tk-stat tk-stat--total">
            <div className="tk-stat-value">{stats.total}</div>
            <div className="tk-stat-label">Total</div>
          </div>
          <div className="tk-stat tk-stat--healthy">
            <div className="tk-stat-value tk-stat-value--healthy">{stats.healthy}</div>
            <div className="tk-stat-label">Healthy</div>
          </div>
          <div className="tk-stat tk-stat--near-limit">
            <div className="tk-stat-value tk-stat-value--near-limit">{stats.nearLimit}</div>
            <div className="tk-stat-label">Near Limit</div>
          </div>
          <div className="tk-stat tk-stat--cooldown">
            <div className="tk-stat-value tk-stat-value--cooldown">{stats.cooldown}</div>
            <div className="tk-stat-label">Cooldown</div>
          </div>
          <div className="tk-stat tk-stat--disabled">
            <div className="tk-stat-value">{stats.disabled}</div>
            <div className="tk-stat-label">Disabled</div>
          </div>
        </div>
      )}

      {/* Env fallback notice */}
      <div className="tk-notice">
        <AlertTriangle size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
        When no DB keys are available for Translation, the worker falls back to <strong>GEMINI_API_KEY</strong> from the app environment. Add DB keys here to enable quota-aware rotation and self-healing.
      </div>

      {pageError && <div className="tk-error">{pageError}</div>}
      {pageMsg && <div className="tk-success">{pageMsg}</div>}

      {/* Add form */}
      {showAdd && (
        <form className="tk-add-form" onSubmit={handleAdd}>
          <p className="tk-add-title">Add Gemini API Key</p>
          {addError && <div className="tk-error">{addError}</div>}
          <div className="tk-form-row">
            <div className="tk-field">
              <label className="tk-label">Display Name</label>
              <input
                className="tk-input"
                placeholder="e.g. Production Key 1"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                required
              />
            </div>
            <div className="tk-field tk-field--wide">
              <label className="tk-label">API Key</label>
              <input
                className="tk-input"
                type="password"
                placeholder="AIza..."
                value={addKey}
                onChange={(e) => setAddKey(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
          </div>
          <div className="tk-field">
            <label className="tk-label">Task Scope</label>
            <div className="tk-scope-checkboxes">
              {(["TRANSLATION", "CASTING_AUDITION"] as const).map((scope) => (
                <label key={scope} className="tk-scope-check">
                  <input
                    type="checkbox"
                    checked={addScopes.includes(scope)}
                    onChange={(e) =>
                      setAddScopes(
                        e.target.checked
                          ? [...addScopes, scope]
                          : addScopes.filter((s) => s !== scope),
                      )
                    }
                  />
                  {SCOPE_LABELS[scope]}
                </label>
              ))}
            </div>
          </div>
          <div className="tk-form-actions">
            <button type="submit" className="tk-btn tk-btn--primary" disabled={adding || !addName.trim() || !addKey.trim() || addScopes.length === 0}>
              {adding ? "Saving…" : "Save Key"}
            </button>
            <button type="button" className="tk-btn tk-btn--ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filter bar */}
      {keys.length > 0 && (
        <div className="tk-filter-bar">
          <div className="tk-search-wrap">
            <Search size={12} className="tk-search-icon" />
            <input
              className="tk-search"
              placeholder="Search by name or key…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {providers.length > 1 && (
            <select className="tk-filter-select" value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)}>
              <option value="all">All Providers</option>
              {providers.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          )}

          <select className="tk-filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}>
            <option value="all">All Status</option>
            <option value="healthy">Healthy</option>
            <option value="near-limit">Near Limit</option>
            <option value="cooldown">Cooldown</option>
            <option value="invalid">Invalid</option>
            <option value="disabled">Disabled</option>
          </select>

          <select className="tk-filter-select" value={filterHealth} onChange={(e) => setFilterHealth(e.target.value as FilterHealth)}>
            <option value="all">All Health</option>
            <option value="attention">
              Needs Attention{needsAttentionCount > 0 ? ` (${needsAttentionCount})` : ""}
            </option>
            <option value="working">Working</option>
          </select>

          <select className="tk-filter-select" value={filterScope} onChange={(e) => setFilterScope(e.target.value as FilterScope)}>
            <option value="all">All Scopes</option>
            <option value="TRANSLATION">Translation only</option>
            <option value="CASTING_AUDITION">Audition only</option>
            <option value="both">Both</option>
          </select>

          <select className="tk-filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
            <option value="newest">Newest</option>
            <option value="recently-used">Recently Used</option>
            <option value="most-failures">Most Failures</option>
            <option value="most-successes">Most Successes</option>
          </select>

          <div className="tk-filter-right">
            {isFiltered && (
              <span className="tk-filter-count">{filteredKeys.length} of {keys.length}</span>
            )}
            {clearableKeys.length > 0 && !confirmBulkClear && (
              <button className="tk-bulk-btn" onClick={() => setConfirmBulkClear(true)}>
                <Zap size={11} />
                Clear Errors ({clearableKeys.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bulk clear confirm */}
      {confirmBulkClear && (
        <div className="tk-bulk-confirm">
          <span className="tk-bulk-confirm-text">
            Clear errors and cooldowns for {clearableKeys.length} key{clearableKeys.length !== 1 ? "s" : ""}?
          </span>
          <button className="tk-btn tk-btn--ghost tk-btn--sm" disabled={bulkClearing} onClick={handleBulkClear}>
            {bulkClearing ? "Clearing…" : "Clear"}
          </button>
          <button className="tk-btn tk-btn--ghost tk-btn--sm" disabled={bulkClearing} onClick={() => setConfirmBulkClear(false)}>
            Cancel
          </button>
        </div>
      )}

      {/* Bulk selection bar */}
      {filteredKeys.length > 0 && (
        <div className="tk-bulk-bar">
          <label className="tk-bulk-check-label">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredKeys.length && filteredKeys.length > 0}
              onChange={(e) => e.target.checked ? selectAllVisible() : clearSelection()}
            />
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
          </label>
          {selectedIds.size > 0 && (
            <div className="tk-bulk-actions">
              <span className="tk-bulk-label">Assign scope:</span>
              {[
                { label: "Translation", scopes: ["TRANSLATION"] },
                { label: "Audition", scopes: ["CASTING_AUDITION"] },
                { label: "Both", scopes: ["TRANSLATION", "CASTING_AUDITION"] },
              ].map(({ label, scopes }) => (
                <button
                  key={label}
                  className="tk-btn tk-btn--ghost tk-btn--sm"
                  disabled={bulkScopeApplying}
                  onClick={() => { setBulkScopeTarget(scopes); setConfirmBulkScope(true); }}
                >
                  {label}
                </button>
              ))}
              <button className="tk-btn tk-btn--ghost tk-btn--sm" onClick={clearSelection}>
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bulk scope confirm */}
      {confirmBulkScope && bulkScopeTarget && (
        <div className="tk-bulk-confirm">
          <span className="tk-bulk-confirm-text">
            Set scope to <strong>{scopeLabel(bulkScopeTarget)}</strong> for {selectedIds.size} key{selectedIds.size !== 1 ? "s" : ""}?
          </span>
          <button className="tk-btn tk-btn--ghost tk-btn--sm" disabled={bulkScopeApplying} onClick={handleBulkScopeApply}>
            {bulkScopeApplying ? "Applying…" : "Apply"}
          </button>
          <button className="tk-btn tk-btn--ghost tk-btn--sm" disabled={bulkScopeApplying} onClick={() => { setConfirmBulkScope(false); setBulkScopeTarget(null); }}>
            Cancel
          </button>
        </div>
      )}

      {/* Key list */}
      {keys.length === 0 ? (
        <div className="tk-empty">No API keys added yet. Add a key above to enable quota-aware rotation.</div>
      ) : filteredKeys.length === 0 ? (
        <div className="tk-empty">No keys match your filters.</div>
      ) : (
        <div className="tk-list">
          {filteredKeys.map((k) => {
            const now         = new Date();
            const quotaStatus = computeQuotaStatus(k, now);
            const isBusy      = (suf: string) => busy === k.id + suf;
            const cardMod     = !k.isEnabled         ? "tk-card--disabled"
              : k.status === "COOLDOWN"              ? "tk-card--cooldown"
              : k.status === "INVALID"               ? "tk-card--invalid"
              : quotaStatus === "full"               ? "tk-card--over-quota"
              : quotaStatus === "near"               ? "tk-card--near-limit"
              : "tk-card--healthy";

            const windowActive   = k.windowResetAt && new Date(k.windowResetAt) > now;
            const effectiveUsed  = windowActive ? k.usedInWindow : 0;
            const quotaPct       = k.windowMaxCalls > 0 ? Math.round((effectiveUsed / k.windowMaxCalls) * 100) : 0;
            const quotaRemaining = k.windowMaxCalls - effectiveUsed;

            return (
              <div key={k.id} className={`tk-card ${cardMod}`}>
                <div className="tk-card-head">
                  <div className="tk-card-select">
                    <input
                      type="checkbox"
                      className="tk-card-checkbox"
                      checked={selectedIds.has(k.id)}
                      onChange={() => toggleSelect(k.id)}
                    />
                  </div>
                  <div className="tk-card-meta">
                    <span className="tk-card-name">{k.name}</span>
                    <StatusBadge status={k.status} isEnabled={k.isEnabled} quotaStatus={quotaStatus} />
                    <ScopeBadge scopes={k.taskScopes} />
                    <span className="tk-badge tk-badge--provider">{k.provider}</span>
                  </div>
                  <div className="tk-card-actions">
                    <button
                      className="tk-btn tk-btn--ghost tk-btn--sm"
                      disabled={!!busy}
                      onClick={() => handleAction(k.id, k.isEnabled ? "disable" : "enable")}
                      title={k.isEnabled ? "Disable" : "Enable"}
                    >
                      <Power size={12} />
                      {isBusy(k.isEnabled ? "disable" : "enable") ? "…" : k.isEnabled ? "Disable" : "Enable"}
                    </button>

                    {/* Scope quick-set */}
                    <div className="tk-scope-menu">
                      <button className="tk-btn tk-btn--ghost tk-btn--sm" disabled={!!busy} title="Set scope">
                        <Languages size={12} />
                        {isBusy("scope") ? "…" : "Scope"}
                      </button>
                      <div className="tk-scope-dropdown">
                        {[
                          { label: "Translation only", scopes: ["TRANSLATION"] },
                          { label: "Audition only",    scopes: ["CASTING_AUDITION"] },
                          { label: "Both",             scopes: ["TRANSLATION", "CASTING_AUDITION"] },
                        ].map(({ label, scopes }) => (
                          <button
                            key={label}
                            className="tk-scope-option"
                            disabled={!!busy}
                            onClick={() => handleSetScope(k.id, scopes)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(k.status !== "HEALTHY" || k.failureCount > 0) && (
                      <button
                        className="tk-btn tk-btn--ghost tk-btn--sm"
                        disabled={!!busy}
                        onClick={() => handleAction(k.id, "reset")}
                        title="Reset failure count, cooldown, and quota window"
                      >
                        <RotateCcw size={12} />
                        {isBusy("reset") ? "…" : "Reset"}
                      </button>
                    )}
                    {confirmDeleteId === k.id ? (
                      <div className="tk-confirm-row">
                        <span className="tk-confirm-text">Delete?</span>
                        <button className="tk-btn tk-btn--danger tk-btn--sm" disabled={!!busy} onClick={() => handleDelete(k.id)}>
                          {isBusy("delete") ? "…" : "Yes"}
                        </button>
                        <button className="tk-btn tk-btn--ghost tk-btn--sm" onClick={() => setConfirmDeleteId(null)}>No</button>
                      </div>
                    ) : (
                      <button className="tk-btn tk-btn--ghost tk-btn--sm" onClick={() => setConfirmDeleteId(k.id)}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {k.keyPreview && <div className="tk-preview">{k.keyPreview}</div>}

                {/* Quota bar */}
                {windowActive && (
                  <div className="tk-quota-wrap">
                    <div className="tk-quota-bar">
                      <div
                        className={`tk-quota-fill tk-quota-fill--${quotaStatus}`}
                        style={{ width: `${Math.min(quotaPct, 100)}%` }}
                      />
                    </div>
                    <span className="tk-quota-text">
                      {effectiveUsed} / {k.windowMaxCalls} used
                      &nbsp;·&nbsp;{quotaRemaining} left
                      &nbsp;·&nbsp;resets in {fmtTimeRemaining(k.windowResetAt!)}
                    </span>
                  </div>
                )}

                <div className="tk-card-detail">
                  <span><CheckCircle size={10} /> {k.successCount} success{k.successCount !== 1 ? "es" : ""}</span>
                  {k.failureCount > 0 && <span className="tk-detail--warn"><AlertTriangle size={10} /> {k.failureCount} failure{k.failureCount !== 1 ? "s" : ""}</span>}
                  {k.lastUsedAt && <span>Last used {fmtDate(k.lastUsedAt)}</span>}
                  <span className="tk-detail--muted">Added {fmtDate(k.createdAt)}</span>
                  {k.cooldownUntil && new Date(k.cooldownUntil) > now && (
                    <span className="tk-detail--cooldown"><Clock size={10} /> Cooldown until {new Date(k.cooldownUntil).toLocaleTimeString()}</span>
                  )}
                </div>

                {k.errorMessage && (
                  <div className="tk-card-error">{k.errorMessage}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
