// JSON-LD structured data builders (schema.org).
//
// This is what lets Google show rich results — video thumbnails, film metadata, and the
// site-name/search box — instead of a plain blue link. Highest-leverage SEO for a film
// site, and it costs nothing at runtime (a static <script> tag in the server-rendered HTML).
//
// Emitted via <script type="application/ld+json"> — see components/json-ld.tsx.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://impactaistudio.com";

/** Studio identity — helps Google build a knowledge panel and link social profiles. */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AIM Studio",
    url: APP_URL,
    logo: `${APP_URL}/images/SP_Logo.jpg`,
    description:
      "A cinematic streaming platform for original AI-powered films, series, shorts, and stories that refuse to look away.",
  };
}

/** Site-level schema. The SearchAction can surface a search box directly in Google results. */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AIM Studio",
    url: APP_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${APP_URL}/works?search={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

type WorkForSchema = {
  slug: string;
  title: string;
  type: string;
  description: string | null;
  posterUrl: string | null;
  heroDesktopUrl: string | null;
  thumbnailUrl: string | null;
  heroMobileUrl: string | null;
  year: number | null;
  duration: number | null;          // minutes
  genre: string | null;
  genres: string[];
  director: string | null;
  createdAt?: Date | string | null;  // uploadDate for VideoObject
};

// Films/shorts → Movie, series → TVSeries, everything else (commercial, branding,
// campaign, case study, trailer) → VideoObject. Google supports rich results for all three.
function schemaTypeFor(workType: string): "Movie" | "TVSeries" | "VideoObject" {
  if (workType === "SERIES") return "TVSeries";
  if (workType === "FULL_FILM" || workType === "SHORT_FILM") return "Movie";
  return "VideoObject";
}

/** Per-work schema for /works/[slug]. Omits empty fields — partial data is fine, wrong data isn't. */
export function workSchema(work: WorkForSchema) {
  const image =
    work.posterUrl ?? work.heroDesktopUrl ?? work.thumbnailUrl ?? work.heroMobileUrl ?? undefined;
  const genreList = work.genres.length > 0 ? work.genres : work.genre ? [work.genre] : undefined;
  const uploadDate =
    work.createdAt ? new Date(work.createdAt).toISOString() : undefined;

  return {
    "@context": "https://schema.org",
    "@type": schemaTypeFor(work.type),
    name: work.title,
    url: `${APP_URL}/works/${work.slug}`,
    ...(work.description ? { description: work.description } : {}),
    ...(image ? { image, thumbnailUrl: image } : {}),
    ...(genreList ? { genre: genreList } : {}),
    // ISO-8601 duration; `duration` is stored in minutes.
    ...(work.duration ? { duration: `PT${work.duration}M` } : {}),
    ...(work.year ? { datePublished: String(work.year) } : {}),
    ...(uploadDate ? { uploadDate } : {}),
    ...(work.director
      ? { director: { "@type": "Person", name: work.director } }
      : {}),
    productionCompany: { "@type": "Organization", name: "AIM Studio" },
  };
}
