import { getPublicCastingRoles } from "@/lib/actions/casting";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { auth } from "@/lib/auth";
import Link from "next/link";
import type { Metadata } from "next";
import "./casting.css";

export const metadata: Metadata = { title: "Casting — AIM Studio" };

const DEFAULT_BG = "/images/casting-default-bg.jpg";

// User-independent public roles/settings — cached so crawler traffic doesn't re-run
// the settings + roles queries per request. Invalidated by revalidateTag(CACHE_TAGS.casting)
// on any role mutation or casting-visibility settings change.
const getCastingRoles = unstable_cache(
  getPublicCastingRoles,
  ["public-casting-roles"],
  { tags: [CACHE_TAGS.casting], revalidate: 300 },
);

export default async function CastingPage() {
  const [{ enabled, backgroundUrl, groups }, session] = await Promise.all([
    getCastingRoles(),
    auth(),
  ]);

  const bgImage = backgroundUrl ?? DEFAULT_BG;

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

  const totalRoles = groups.reduce((sum, g) => sum + g.roles.length, 0);

  return (
    <main className="casting-page">
      {/* ── Hero ── */}
      <section
        className="casting-hero"
        style={{ backgroundImage: `url(${bgImage})` }}
      >
        <div className="casting-hero-overlay" />
        <div className="casting-hero-content">
          <span className="casting-hero-rule" />
          <p className="casting-eyebrow">Open Roles</p>
          <h1 className="casting-hero-title">Casting Opportunities</h1>
          <p className="casting-hero-sub">
            Interested in joining an AIM Studio production? Review open roles below and apply when ready.
          </p>
        </div>
      </section>

      {/* ── Roles grouped by project ── */}
      {totalRoles === 0 ? (
        <div className="casting-empty">
          <p>No roles are currently open. Check back soon.</p>
        </div>
      ) : (
        <div className="casting-groups">
          {groups.map((group) => (
            <section key={group.work?.id ?? "general"} className="casting-group">
              {/* Project header */}
              <div className="casting-group-header">
                {group.work?.posterUrl && (
                  <img
                    src={group.work.posterUrl}
                    alt={group.work.title}
                    className="casting-group-poster"
                  />
                )}
                <div className="casting-group-info">
                  <p className="casting-group-eyebrow">Production</p>
                  <h2 className="casting-group-title">
                    {group.work
                      ? <Link href={`/works/${group.work.slug}`} className="casting-group-link">{group.work.title}</Link>
                      : "General Casting"}
                  </h2>
                  <p className="casting-group-count">
                    {group.roles.length} open role{group.roles.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Role cards */}
              <div className="casting-roles">
                {group.roles.map((role) => (
                  <div key={role.id} className="casting-role-card">
                    <div className="casting-role-meta">
                      <span className="casting-tag casting-tag--open">Open</span>
                      {role.requireGender && role.allowedGender && (
                        <span className="casting-tag">{role.allowedGender}</span>
                      )}
                      {role.requireAgeRange && role.minAge != null && role.maxAge != null && (
                        <span className="casting-tag">Ages {role.minAge}–{role.maxAge}</span>
                      )}
                      {role.requireVoiceSample && (
                        <span className="casting-tag">Voice Required</span>
                      )}
                    </div>
                    <h3 className="casting-role-title">{role.title}</h3>
                    <p className="casting-role-desc">
                      {role.description.slice(0, 200)}{role.description.length > 200 ? "…" : ""}
                    </p>
                    {role.applicationCount > 0 && (
                      <p className="casting-role-appcount">
                        {role.applicationCount} application{role.applicationCount !== 1 ? "s" : ""}
                      </p>
                    )}
                    <div className="casting-role-actions">
                      <Link href={`/casting/${role.slug}`} className="casting-btn casting-btn--outline">
                        View Role
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
            </section>
          ))}
        </div>
      )}

      {/* ── Before You Apply ── */}
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
