"use client";

import { useEffect, useRef } from "react";
import { signInWithWelcomeToken } from "@/lib/actions/auth";

export default function WelcomeLoginClient({ uid, token }: { uid: string; token: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);

  return (
    <div className="auth-card" style={{ textAlign: "center" }}>
      <p className="auth-sub">Taking you to your dashboard…</p>
      <form ref={formRef} action={signInWithWelcomeToken}>
        <input type="hidden" name="uid"   value={uid} />
        <input type="hidden" name="token" value={token} />
      </form>
    </div>
  );
}
