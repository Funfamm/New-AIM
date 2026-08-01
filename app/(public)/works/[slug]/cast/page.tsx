import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Instagram } from "lucide-react";
import type { Metadata } from "next";
import "./cast.css";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const work = await prisma.work.findUnique({ where: { slug }, select: { title: true } });
  if (!work) return { title: "Not Found" };
  return { title: `${work.title} — Cast & Crew` };
}

async function getWorkCast(slug: string) {
  return prisma.work.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, status: true,
      cast: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true, name: true, jobTitle: true,
          character: true, bio: true, photoUrl: true, instagramUrl: true,
        },
      },
    },
  });
}

export default async function CastPage({ params }: Props) {
  const { slug } = await params;
  const work = await getWorkCast(slug);

  const PUBLIC_STATUSES = new Set(["PUBLISHED", "UPCOMING", "IN_PRODUCTION"]);
  if (!work || !PUBLIC_STATUSES.has(work.status)) notFound();

  // Collect unique job titles for filter pills
  const allRoles = Array.from(new Set(work.cast.map((m) => m.jobTitle))).sort();

  return (
    <main className="cast-page">
      <div className="container-app">

        {/* Back link */}
        <Link href={`/works/${slug}`} className="cast-back">
          <ChevronLeft size={15} /> {work.title}
        </Link>

        {/* Header */}
        <div className="cast-header">
          <h1 className="cast-title">Cast &amp; Crew</h1>
          <p className="cast-subtitle">{work.title}</p>
        </div>

        {work.cast.length === 0 ? (
          <p className="cast-empty">No cast information available yet.</p>
        ) : (
          <>
            {/* Role filter pills — rendered server-side; JS filtering via URL is optional; keeping it simple with anchor sections */}
            {allRoles.length > 1 && (
              <div className="cast-filters" aria-label="Filter by role">
                {allRoles.map((role) => (
                  <a key={role} href={`#role-${role.toLowerCase().replace(/\s+/g, "-")}`} className="cast-pill">
                    {role}
                  </a>
                ))}
              </div>
            )}

            {/* Cast grid */}
            <div className="cast-grid">
              {work.cast.map((m) => (
                <div
                  key={m.id}
                  className="cast-card"
                  id={`role-${m.jobTitle.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {/* Portrait */}
                  <div className="cast-portrait">
                    {m.photoUrl
                      ? <img src={m.photoUrl} alt={m.name} className="cast-portrait-img" loading="lazy" />
                      : <span className="cast-portrait-initial">{m.name.charAt(0).toUpperCase()}</span>
                    }
                  </div>

                  {/* Info */}
                  <div className="cast-info">
                    <p className="cast-name">{m.name}</p>
                    <p className="cast-role">{m.jobTitle}</p>
                    {m.character && <p className="cast-character">as {m.character}</p>}
                    {m.bio && <p className="cast-bio">{m.bio}</p>}
                    {m.instagramUrl && (
                      <a
                        href={m.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cast-ig"
                        aria-label={`${m.name} on Instagram`}
                      >
                        <Instagram size={13} /> Instagram
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </main>
  );
}
