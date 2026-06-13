import { getPublicCastingRoles } from "@/lib/actions/casting";
import { auth } from "@/lib/auth";
import Link from "next/link";
import type { Metadata } from "next";
import "./casting.css";

export const metadata: Metadata = { title: "Casting — AIM Studio" };

export default async function CastingPage() {
  const [{ enabled, roles }, session] = await Promise.all([
    getPublicCastingRoles(),
    auth(),
  ]);

  if (!enabled) {
    return (
      <main className="casting-closed">
        <div className="casting-closed-inner">
          <span className="casting-closed-mark" />
          <p className="casting-closed-label">Casting</p>
          <h1 className="casting-closed-title">Currently Closed</h1>
          <p className="casting-closed-text">
            Casting is currently closed. Follow AIM Studio for future opportunities.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="casting-page">
      <section className="casting-hero">
        <span className="casting-hero-rule" />
        <p className="casting-eyebrow">Open Roles</p>
        <h1 className="casting-hero-title">Casting Opportunities</h1>
        <p className="casting-hero-sub">
          AIM Studio is currently seeking talent for the roles below. Review each role and apply when ready.
        </p>
      </section>

      {roles.length === 0 ? (
        <div className="casting-empty">
          <p>No roles are currently open. Check back soon.</p>
        </div>
      ) : (
        <div className="casting-roles">
          {roles.map((role) => (
            <div key={role.id} className="casting-role-card">
              <div className="casting-role-meta">
                {role.requireGender && role.allowedGender && (
                  <span className="casting-tag">{role.allowedGender}</span>
                )}
                {role.requireAgeRange && role.minAge != null && role.maxAge != null && (
                  <span className="casting-tag">Ages {role.minAge}–{role.maxAge}</span>
                )}
                {role.requireVoiceSample && (
                  <span className="casting-tag">Voice Sample Required</span>
                )}
              </div>
              <h2 className="casting-role-title">{role.title}</h2>
              <p className="casting-role-desc">{role.description.slice(0, 200)}{role.description.length > 200 ? "…" : ""}</p>
              <div className="casting-role-actions">
                <Link href={`/casting/${role.slug}`} className="casting-btn casting-btn--outline">
                  View Details
                </Link>
                {session?.user ? (
                  <Link href={`/casting/${role.slug}/apply`} className="casting-btn casting-btn--primary">
                    Apply Now
                  </Link>
                ) : (
                  <Link
                    href={`/login?redirect=${encodeURIComponent(`/casting/${role.slug}/apply`)}`}
                    className="casting-btn casting-btn--primary"
                  >
                    Sign In to Apply
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="casting-policy-preview">
        <h2 className="casting-policy-title">Before You Apply</h2>
        <ul className="casting-policy-list">
          <li>All casting opportunities are unpaid and do not include financial compensation.</li>
          <li>You must be 18 or older to apply.</li>
          <li>You must submit 4–6 images and (where required) a 1–3 minute audio sample.</li>
          <li>Submissions are reviewed for completeness and quality only — not for appearance or protected characteristics.</li>
          <li>You may withdraw your application before review begins.</li>
          <li>AIM Studio makes all final casting decisions.</li>
        </ul>
      </section>
    </main>
  );
}
