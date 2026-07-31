// Renders a schema.org JSON-LD block into the server-rendered HTML.
// Server component — zero client JS. dangerouslySetInnerHTML is the documented way to
// emit JSON-LD in Next.js; the payload is our own server-built object, never user input,
// and `<` is escaped so a stray value can't break out of the script tag.
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
