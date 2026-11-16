import s from "./brief.module.css";

// The brief has its own look; without this the site's global spinner (app/loading.tsx)
// flashes before the stadium. A plain night-sky screen matches the cover's first frame.
export default function BriefLoading() {
  return <div aria-busy="true" aria-label="Loading your brief" className={s.loading} />;
}
