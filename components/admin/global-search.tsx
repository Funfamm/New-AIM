"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Search, Clapperboard, Users, Rss } from "lucide-react";
import "./global-search.css";

type WorkResult = { id: string; title: string; type: string; status: string; slug: string };
type UserResult = { id: string; name: string | null; email: string; role: string };
type SubResult  = { id: string; email: string; name: string | null; country: string | null };
type Results = { works: WorkResult[]; users: UserResult[]; subscribers: SubResult[] };

export default function GlobalSearch() {
  const [query, setQuery]     = useState("");
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(await res.json() as Results);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setResults(null); return; }
    timerRef.current = setTimeout(() => search(query), 280);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, search]);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const hasResults = results && (
    results.works.length > 0 || results.users.length > 0 || results.subscribers.length > 0
  );
  const showDrop = open && (loading || hasResults || (query.length >= 2 && !loading));

  function handleResultClick() {
    setOpen(false);
    setQuery("");
    setResults(null);
  }

  return (
    <div className="gsearch-wrap" ref={wrapRef}>
      <div className="gsearch-input-row">
        <Search size={14} className="gsearch-icon" />
        <input
          ref={inputRef}
          type="search"
          className="gsearch-input"
          placeholder="Search works, users, subscribers…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
          spellCheck={false}
        />
        <span className="gsearch-kbd">⌘K</span>
      </div>

      {showDrop && (
        <div className="gsearch-dropdown">
          {loading && <div className="gsearch-spinner">Searching…</div>}

          {!loading && results && !hasResults && (
            <div className="gsearch-empty">No results for &ldquo;{query}&rdquo;</div>
          )}

          {!loading && results && results.works.length > 0 && (
            <>
              <div className="gsearch-group-label">
                <Clapperboard size={10} style={{ display: "inline", marginRight: 4 }} />
                Works
              </div>
              {results.works.map((w) => (
                <Link
                  key={w.id}
                  href={`/admin/works/${w.id}`}
                  className="gsearch-result"
                  onClick={handleResultClick}
                >
                  <div className="gsearch-result-icon"><Clapperboard size={13} /></div>
                  <div className="gsearch-result-body">
                    <div className="gsearch-result-title">{w.title}</div>
                    <div className="gsearch-result-sub">{w.type.replace("_", " ").toLowerCase()}</div>
                  </div>
                  <span className={`gsearch-result-badge gsearch-badge--${w.status === "PUBLISHED" ? "published" : "draft"}`}>
                    {w.status.toLowerCase()}
                  </span>
                </Link>
              ))}
            </>
          )}

          {!loading && results && results.users.length > 0 && (
            <>
              <div className="gsearch-group-label">
                <Users size={10} style={{ display: "inline", marginRight: 4 }} />
                Users
              </div>
              {results.users.map((u) => (
                <Link
                  key={u.id}
                  href={`/admin/users?q=${encodeURIComponent(u.email)}`}
                  className="gsearch-result"
                  onClick={handleResultClick}
                >
                  <div className="gsearch-result-icon"><Users size={13} /></div>
                  <div className="gsearch-result-body">
                    <div className="gsearch-result-title">{u.name ?? u.email}</div>
                    <div className="gsearch-result-sub">{u.email}</div>
                  </div>
                  <span className="gsearch-result-badge gsearch-badge--user">
                    {u.role.toLowerCase()}
                  </span>
                </Link>
              ))}
            </>
          )}

          {!loading && results && results.subscribers.length > 0 && (
            <>
              <div className="gsearch-group-label">
                <Rss size={10} style={{ display: "inline", marginRight: 4 }} />
                Subscribers
              </div>
              {results.subscribers.map((s) => (
                <Link
                  key={s.id}
                  href={`/admin/subscribers?q=${encodeURIComponent(s.email)}`}
                  className="gsearch-result"
                  onClick={handleResultClick}
                >
                  <div className="gsearch-result-icon"><Rss size={13} /></div>
                  <div className="gsearch-result-body">
                    <div className="gsearch-result-title">{s.name ?? s.email}</div>
                    <div className="gsearch-result-sub">{s.email}{s.country ? ` · ${s.country}` : ""}</div>
                  </div>
                  <span className="gsearch-result-badge gsearch-badge--subscriber">subscriber</span>
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
