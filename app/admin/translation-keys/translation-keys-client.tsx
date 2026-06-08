"use client";

import { useMemo, useState } from "react";
import {
  Plus, Trash2, RotateCcw, Power, CheckCircle, AlertTriangle,
  Clock, XCircle, Key, Search, Zap,
} from "lucide-react";

type ApiKey = {
  id: string;
  provider: string;
  name: string;
  keyPreview: string | null;
  isEnabled: boolean;
  status: string;
  failureCount: number;
  successCount: number;
  lastUsedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  cooldownUntil: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type FilterStatus = "all" | "healthy" | "cooldown" | "invalid" | "disabled";
type FilterHealth = "all" | "attention" | "working";
type SortBy       = "newest" | "recently-used" | "most-failures" | "most-successes";

type Props = { initialKeys: ApiKey[] };

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function matchesStatus(k: ApiKey, f: FilterStatus, now: Date): boolean {
  if (f === "all")      return true;
  if (f === "disabled") return !k.isEnabled;
  if (!k.isEnabled)     return false;
  if (f === "healthy")  return k.status === "HEALTHY" && !(k.cooldownUntil && new Date(k.cooldownUntil) > now);
  if (f === "cooldown") return k.status === "COOLDOWN" || !!(k.cooldownUntil && new Date(k.cooldownUntil) > now);
  if (f === "invalid")  return k.status === "INVALID";
  return true;
}

function matchesHealth(k: ApiKey, f: FilterHealth): boolean {
  if (f === "all")       return true;
  const needsAttention   = k.failureCount > 0 || k.status !== "HEALTHY" || !k.isEnabled;
  if (f === "attention") return needsAttention;
  if (f === "working")   return k.isEnabled && k.status === "HEALTHY";
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

function StatusBadge({ status, isEnabled }: { status: string; isEnabled: boolean }) {
  if (!isEnabled)            return <span className="tk-badge tk-badge--disabled">Disabled</span>;
  if (status === "HEALTHY")  return <span className="tk-badge tk-badge--healthy"><CheckCircle size={9} /> Healthy</span>;
  if (status === "COOLDOWN") return <span className="tk-badge tk-badge--cooldown"><Clock size={9} /> Cooldown</span>;
  if (status === "INVALID")  return <span className="tk-badge tk-badge--invalid"><XCircle size={9} /> Invalid</span>;
  return <span className="tk-badge tk-badge--disabled">{status}</span>;
}

export default function TranslationKeysClient({ initialKeys }: Props) {
  const [keys, setKeys]                       = useState<ApiKey[]>(initialKeys);
  const [showAdd, setShowAdd]                 = useState(false);
  const [addName, setAddName]                 = useState("");
  const [addKey, setAddKey]                   = useState("");
  const [adding, setAdding]                   = useState(false);
  const [addError, setAddError]               = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy]                       = useState<string | null>(null);
  const [pageError, setPageError]             = useState<string | null>(null);

  // filter + sort
  const [search, setSearch]                 = useState("");
  const [filterProvider, setFilterProvider] = useState("all");
  const [filterStatus, setFilterStatus]     = useState<FilterStatus>("all");
  const [filterHealth, setFilterHealth]     = useState<FilterHealth>("all");
  const [sortBy, setSortBy]                 = useState<SortBy>("newest");

  // bulk clear
  const [confirmBulkClear, setConfirmBulkClear] = useState(false);
  const [bulkClearing, setBulkClearing]         = useState(false);
  const [bulkClearedMsg, setBulkClearedMsg]     = useState<string | null>(null);

  const providers = useMemo(() => [...new Set(keys.map((k) => k.provider))], [keys]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total:     keys.length,
      healthy:   keys.filter((k) => k.isEnabled && k.status === "HEALTHY" && !(k.cooldownUntil && new Date(k.cooldownUntil) > now)).length,
      attention: keys.filter((k) => k.failureCount > 0 || k.status !== "HEALTHY" || !k.isEnabled).length,
      cooldown:  keys.filter((k) => k.isEnabled && (k.status === "COOLDOWN" || !!(k.cooldownUntil && new Date(k.cooldownUntil) > now))).length,
      disabled:  keys.filter((k) => !k.isEnabled).length,
    };
  }, [keys]);

  const needsAttentionCount = stats.attention;

  const filteredKeys = useMemo(() => {
    const now = new Date();
    const q   = search.toLowerCase().trim();
    const filtered = keys.filter((k) => {
      if (q && !k.name.toLowerCase().includes(q) && !(k.keyPreview ?? "").toLowerCase().includes(q)) return false;
      if (filterProvider !== "all" && k.provider !== filterProvider) return false;
      if (!matchesStatus(k, filterStatus, now)) return false;
      if (!matchesHealth(k, filterHealth)) return false;
      return true;
    });
    return sortKeys(filtered, sortBy);
  }, [keys, search, filterProvider, filterStatus, filterHealth, sortBy]);

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

  const isFiltered = !!(search || filterStatus !== "all" || filterHealth !== "all" || filterProvider !== "all");

  async function refresh() {
    const res = await fetch("/api/admin/translation-keys");
    if (res.ok) {
      const data = await res.json() as { keys: ApiKey[] };
      setKeys(data.keys);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim() || !addKey.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/admin/translation-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim(), key: addKey.trim() }),
      });
      const data = await res.json() as { error?: string; key?: ApiKey };
      if (!res.ok) { setAddError(data.error ?? "Failed to add key"); return; }
      setShowAdd(false);
      setAddName("");
      setAddKey("");
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
        setBulkClearedMsg(`Cleared errors for ${d.cleared} key${d.cleared !== 1 ? "s" : ""}.`);
        setTimeout(() => setBulkClearedMsg(null), 4000);
      }
    } finally {
      setBulkClearing(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="tk-heading">
        <div>
          <h1 className="tk-title"><Key size={18} /> Translation Keys</h1>
          <p className="tk-title-sub">Manage encrypted Gemini keys used for subtitle translation.</p>
        </div>
        <button className="tk-btn tk-btn--primary" onClick={() => { setShowAdd((v) => !v); setAddError(null); }}>
          <Plus size={14} />
          Add Key
        </button>
      </div>

      {/* Stats row */}
      {keys.length > 0 && (
        <div className="tk-stats">
          <div className="tk-stat">
            <div className="tk-stat-value">{stats.total}</div>
            <div className="tk-stat-label">Total</div>
          </div>
          <div className="tk-stat tk-stat--healthy">
            <div className="tk-stat-value tk-stat-value--healthy">{stats.healthy}</div>
            <div className="tk-stat-label">Healthy</div>
          </div>
          <div className="tk-stat tk-stat--attention">
            <div className="tk-stat-value tk-stat-value--attention">{stats.attention}</div>
            <div className="tk-stat-label">Attention</div>
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
        When no DB keys are available, the worker falls back to <strong>GEMINI_API_KEY</strong> from the app environment. Add DB keys here to enable key rotation and self-healing.
      </div>

      {pageError && <div className="tk-error">{pageError}</div>}
      {bulkClearedMsg && <div className="tk-success">{bulkClearedMsg}</div>}

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
          <div className="tk-form-actions">
            <button type="submit" className="tk-btn tk-btn--primary" disabled={adding || !addName.trim() || !addKey.trim()}>
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

      {/* Key list */}
      {keys.length === 0 ? (
        <div className="tk-empty">No API keys added yet. Add a key above to enable DB-backed rotation.</div>
      ) : filteredKeys.length === 0 ? (
        <div className="tk-empty">No keys match your filters.</div>
      ) : (
        <div className="tk-list">
          {filteredKeys.map((k) => {
            const isBusy   = (suf: string) => busy === k.id + suf;
            const cardMod  = !k.isEnabled ? "tk-card--disabled"
              : k.status === "COOLDOWN"   ? "tk-card--cooldown"
              : k.status === "INVALID"    ? "tk-card--invalid"
              : "tk-card--healthy";
            return (
              <div key={k.id} className={`tk-card ${cardMod}`}>
                <div className="tk-card-head">
                  <div className="tk-card-meta">
                    <span className="tk-card-name">{k.name}</span>
                    <StatusBadge status={k.status} isEnabled={k.isEnabled} />
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
                    {(k.status !== "HEALTHY" || k.failureCount > 0) && (
                      <button
                        className="tk-btn tk-btn--ghost tk-btn--sm"
                        disabled={!!busy}
                        onClick={() => handleAction(k.id, "reset")}
                        title="Reset failure count and cooldown"
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

                <div className="tk-card-detail">
                  <span><CheckCircle size={10} /> {k.successCount} success{k.successCount !== 1 ? "es" : ""}</span>
                  {k.failureCount > 0 && <span className="tk-detail--warn"><AlertTriangle size={10} /> {k.failureCount} failure{k.failureCount !== 1 ? "s" : ""}</span>}
                  {k.lastUsedAt && <span>Last used {fmtDate(k.lastUsedAt)}</span>}
                  <span className="tk-detail--muted">Added {fmtDate(k.createdAt)}</span>
                  {k.cooldownUntil && new Date(k.cooldownUntil) > new Date() && (
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
