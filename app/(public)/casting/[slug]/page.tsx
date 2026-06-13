import { getPublicCastingRole, getUserApplicationForRole } from "@/lib/actions/casting";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import "../casting.css";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const role = await getPublicCastingRole(slug);
  return { title: role ? `${role.title} — AIM Studio Casting` : "Casting" };
}

export default async function CastingRolePage({ params }: Props) {
  const { slug } = await params;

  const [role, session] = await Promise.all([
    getPublicCastingRole(slug),
    auth(),
  ]);

  if (!role) notFound();

  const existingApp = session?.user
    ? await getUserApplicationForRole(role.id)
    : null;

  const alreadyApplied = !!existingApp;

  return (
    <main className="casting-role-detail">
      <div className="casting-role-detail-back">
        <Link href="/casting" className="casting-back-link">← All Roles</Link>
      </div>

      <div className="casting-role-detail-header">
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
          {!role.isOpen && (
            <span className="casting-tag casting-tag--closed">Closed</span>
          )}
        </div>
        <h1 className="casting-role-detail-title">{role.title}</h1>
      </div>

      <div className="casting-role-detail-body">
        <section className="casting-role-detail-desc">
          <h2 className="casting-detail-section-title">About This Role</h2>
          <p className="casting-detail-text">{role.description}</p>
        </section>

        <section className="casting-role-requirements">
          <h2 className="casting-detail-section-title">Requirements</h2>
          <ul className="casting-req-list">
            <li>Must be 18 years of age or older</li>
            <li>Upload 4–6 clear, well-lit photos</li>
            {role.requireVoiceSample && (
              <li>Submit a 1–3 minute audio voice sample</li>
            )}
            {role.requireGender && role.allowedGender && (
              <li>Gender: {role.allowedGender}</li>
            )}
            {role.requireAgeRange && role.minAge != null && role.maxAge != null && (
              <li>Age range: {role.minAge}–{role.maxAge}</li>
            )}
            <li>Provide an active social media handle</li>
            <li>Complete and sign the policy and release forms</li>
          </ul>
        </section>

        <section className="casting-role-policy-note">
          <h2 className="casting-detail-section-title">Important Notes</h2>
          <ul className="casting-req-list casting-req-list--muted">
            <li>This is an unpaid opportunity.</li>
            <li>You may withdraw before your application enters review.</li>
            <li>AIM Studio makes all final casting decisions.</li>
            <li>Applications are evaluated for completeness and suitability to the role only.</li>
          </ul>
        </section>
      </div>

      <div className="casting-role-detail-cta">
        {!role.isOpen ? (
          <p className="casting-closed-note">This role is no longer accepting applications.</p>
        ) : alreadyApplied ? (
          <div className="casting-already-applied">
            <p className="casting-already-applied-text">You have already applied for this role.</p>
            <Link
              href={`/casting/applications/track/${existingApp!.trackingToken}`}
              className="casting-btn casting-btn--outline"
            >
              Track My Application
            </Link>
          </div>
        ) : session?.user ? (
          <Link href={`/casting/${role.slug}/apply`} className="casting-btn casting-btn--primary casting-btn--lg">
            Apply for This Role
          </Link>
        ) : (
          <div className="casting-signin-prompt">
            <p className="casting-signin-text">You must be signed in to apply.</p>
            <Link
              href={`/login?redirect=${encodeURIComponent(`/casting/${role.slug}/apply`)}`}
              className="casting-btn casting-btn--primary casting-btn--lg"
            >
              Sign In to Apply
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
