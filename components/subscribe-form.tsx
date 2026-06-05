"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Script from "next/script";
import "./subscribe-form.css";

declare global {
  interface Window {
    turnstile?: {
      render:  (el: HTMLElement, opts: object) => string;
      reset:   (id: string) => void;
      remove:  (id: string) => void;
    };
  }
}

export default function SubscribeForm() {
  const [email,     setEmail]     = useState("");
  const [status,    setStatus]    = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg,  setErrorMsg]  = useState("");
  const [token,     setToken]     = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  const widgetDivRef = useRef<HTMLDivElement>(null);
  const widgetIdRef  = useRef<string | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const mountWidget = useCallback(() => {
    if (!widgetDivRef.current || !window.turnstile || !siteKey) return;
    if (widgetIdRef.current) return; // already mounted
    widgetIdRef.current = window.turnstile.render(widgetDivRef.current, {
      sitekey:           siteKey,
      callback:          (t: string) => setToken(t),
      "expired-callback": () => setToken(null),
      "error-callback":  () => setToken(null),
      retry:             "auto",
      "retry-interval":  5000,
      theme:             "dark",
    });
  }, [siteKey]);

  // Mount after script loads
  useEffect(() => {
    if (scriptReady) mountWidget();
  }, [scriptReady, mountWidget]);

  function resetWidget() {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
    setToken(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || !email.trim() || status === "submitting") return;

    const hp = (e.currentTarget.elements.namedItem("hp") as HTMLInputElement)?.value ?? "";

    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/subscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:           email.trim(),
          turnstileToken:  token,
          hp,
          startedAt:       startedAtRef.current,
          source:          "footer",
          sourcePath:      window.location.pathname,
        }),
      });

      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        const data = await res.json().catch(() => ({})) as { message?: string };
        setErrorMsg(data.message ?? "Something went wrong. Please try again.");
        setStatus("error");
        resetWidget();
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
      resetWidget();
    }
  }

  // If site key is not configured, silently render nothing — don't break the page
  if (!siteKey) return null;

  return (
    <form onSubmit={handleSubmit} className="sub-form" noValidate>
      {/* Honeypot — hidden from real users */}
      <input
        type="text"
        name="hp"
        tabIndex={-1}
        aria-hidden="true"
        className="sub-hp"
        autoComplete="off"
      />

      {/* Turnstile script — loaded lazily */}
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="lazyOnload"
        onReady={() => setScriptReady(true)}
      />

      {status === "success" ? (
        <p className="sub-success">
          You&apos;re on the list.{" "}
          <span className="sub-success-sub">We&apos;ll keep you updated.</span>
        </p>
      ) : (
        <>
          <div className="sub-input-row">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Your email"
              required
              autoComplete="email"
              className="sub-input"
              disabled={status === "submitting"}
            />
            <button
              type="submit"
              className="sub-btn"
              disabled={!token || !email.trim() || status === "submitting"}
            >
              {status === "submitting" ? "Joining…" : "Join the list"}
            </button>
          </div>

          {/* Turnstile widget mount point */}
          <div ref={widgetDivRef} className="sub-turnstile" />

          {status === "error" && (
            <p className="sub-error" role="alert">{errorMsg}</p>
          )}
        </>
      )}
    </form>
  );
}
