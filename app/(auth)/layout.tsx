// Auth pages share a centered, cinematic background layout
import type { Metadata } from "next";
import "./auth-layout.css";

// Auth screens must never appear in search results — they're functional pages with no
// content value, and indexing them wastes crawl budget and looks unprofessional in SERPs.
// Set on the layout so every child (login, register, forgot/reset-password, welcome-login)
// inherits it. `follow: true` still lets link equity flow onward to real content.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-layout">
      {children}
    </div>
  );
}
