import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import TestEmailForm from "./test-email-form";

export default async function TabTest() {
  const session = await auth();
  const adminEmail = session?.user?.email ?? "";

  const [works, settings] = await Promise.all([
    prisma.work.findMany({
      orderBy: { title: "asc" },
      select:  { id: true, title: true, type: true, slug: true },
      take:    200,
    }),
    prisma.adminSettings.findUnique({ where: { id: "singleton" }, select: { testEmailRecipient: true } }),
  ]);

  const testRecipient = settings?.testEmailRecipient?.trim() ?? "";

  return (
    <>
      <section className="email-section">
        <h2 className="email-section-title">Send test email</h2>
        <p className="email-sub" style={{ marginBottom: "1.75rem" }}>
          Preview any email type and send a single test copy to a safe recipient.
          Test emails are logged as ADMIN_ALERT and do not affect subscribers, campaigns, or application status.
        </p>

        <TestEmailForm
          works={works}
          adminEmail={adminEmail}
          testEmailRecipient={testRecipient}
        />
      </section>

      <section className="email-section">
        <h2 className="email-section-title">Preview rules</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.75rem" }}>
          {[
            { label: "No subscriber sends", note: "Test email goes only to the address you specify." },
            { label: "No campaign markers", note: "Test does not mark any campaign as sent or queued." },
            { label: "No status changes", note: "Casting application status is never updated by a test." },
            { label: "Logged as test", note: "Email log records type=ADMIN_ALERT + metadata { test: true }." },
            { label: "Sample data used", note: "Non-work emails use placeholder names/tokens — no real user data." },
            { label: "Real work data", note: "Work emails use actual poster, title, genres, and media flags." },
          ].map((r) => (
            <div key={r.label} style={{ padding: "0.9rem 1rem", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 6 }}>
              <p style={{ margin: "0 0 4px", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#e8c97e" }}>{r.label}</p>
              <p style={{ margin: 0, fontSize: "0.8125rem", color: "#6b7280", lineHeight: 1.6 }}>{r.note}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
