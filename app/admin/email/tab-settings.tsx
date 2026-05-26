import { prisma } from "@/lib/prisma";
import Link from "next/link";
import TestEmailButton from "./test-email-button";

export default async function TabSettings() {
  const settings = await prisma.adminSettings.findUnique({
    where: { id: "singleton" },
    select: {
      emailSendingEnabled:       true,
      bulkEmailSendingEnabled:   true,
      testEmailRecipient:        true,
      fromDisplayName:           true,
      welcomeEmailEnabled:       true,
      passwordResetEmailEnabled: true,
      notificationEmailEnabled:  true,
    },
  });

  return (
    <>
      {/* ── Email system status ───────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Email system status</h2>
        <div className="email-config-grid">
          <div className="email-config-card">
            <p className="email-config-label">Email sending</p>
            <div className="email-config-row">
              <span className={`email-status-dot ${settings?.emailSendingEnabled ? "email-status-dot--ok" : "email-status-dot--err"}`} />
              <span className="email-config-val">
                {settings?.emailSendingEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
          <div className="email-config-card">
            <p className="email-config-label">Bulk email (ACS)</p>
            <div className="email-config-row">
              <span className={`email-status-dot ${settings?.bulkEmailSendingEnabled ? "email-status-dot--ok" : "email-status-dot--warn"}`} />
              <span className="email-config-val">
                {settings?.bulkEmailSendingEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
          <div className="email-config-card">
            <p className="email-config-label">Welcome emails</p>
            <div className="email-config-row">
              <span className={`email-status-dot ${settings?.welcomeEmailEnabled ? "email-status-dot--ok" : "email-status-dot--warn"}`} />
              <span className="email-config-val">
                {settings?.welcomeEmailEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
          <div className="email-config-card">
            <p className="email-config-label">Test recipient</p>
            <p className="email-config-val" style={{ fontSize: "0.82rem" }}>
              {settings?.testEmailRecipient ?? "Admin account (default)"}
            </p>
          </div>
        </div>
        <p className="email-hint" style={{ marginTop: "1rem" }}>
          Full email settings are configured in{" "}
          <Link href="/admin/settings" style={{ color: "var(--color-brand-accent)" }}>
            Admin Settings → Email
          </Link>
          .
        </p>
      </section>

      {/* ── Test transactional email ──────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Test transactional email</h2>
        <p className="email-hint">
          Sends a test email via Microsoft Graph.{" "}
          {settings?.testEmailRecipient
            ? `Delivers to: ${settings.testEmailRecipient}.`
            : "Delivers to your admin account (set a test recipient in Admin Settings to override)."}
        </p>
        <TestEmailButton />
      </section>
    </>
  );
}
