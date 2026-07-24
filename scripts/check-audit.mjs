// CI security-audit gate with a documented allowlist.
//
// Fails on ANY high/critical advisory EXCEPT allowlisted ones. This is strictly narrower
// than silencing the gate (e.g. `--audit-level=critical`): every high/critical advisory
// in a package we actually ship still fails the build — verified by CI, which caught a
// brand-new postcss advisory the day after this gate landed.
//
// Reads audit.json produced by `npm audit --json`.
import { readFileSync } from "node:fs";

// Packages with NO runtime presence in the deployed app — they run only during
// `next build`, never in the browser or the server runtime. Their advisories therefore
// have no runtime attack surface for us. Allowlisted by package so we don't have to chase
// each new build-time GHSA individually. Keep this list tiny and justify every entry.
const ALLOW_PACKAGES = new Map([
  // postcss: a build-time CSS processor, pulled only via Next.js / Tailwind's pinned
  // transitive versions. It processes OUR OWN CSS at build and is never shipped to any
  // runtime, so its advisories (sourceMappingURL / CSS-stringify handling) can't be
  // reached by untrusted input in production. npm `overrides` can't move Next's pin and
  // `audit fix --force` wants next@9. Revisit if Next/Tailwind bump their postcss pins.
  ["postcss", "build-time-only CSS processor (next/tailwind pinned transitive); no runtime surface"],
]);

// Specific advisory IDs to allow (use sparingly; prefer fixing). Empty by default.
const ALLOW_ADVISORIES = new Map([]);

const BLOCKING = new Set(["high", "critical"]);

const report = JSON.parse(readFileSync("audit.json", "utf8"));

const blocking = new Map(); // id -> {pkg, sev}
const ignored = new Map();  // id -> reason
for (const v of Object.values(report.vulnerabilities ?? {})) {
  if (!BLOCKING.has(v.severity)) continue;
  for (const via of v.via ?? []) {
    if (!via || typeof via !== "object" || !via.url) continue; // string refs resolve via their own entry
    const id = via.url.split("/").pop();
    const pkg = via.name;
    if (ALLOW_ADVISORIES.has(id)) { ignored.set(id, ALLOW_ADVISORIES.get(id)); continue; }
    if (ALLOW_PACKAGES.has(pkg)) { ignored.set(id, `${pkg}: ${ALLOW_PACKAGES.get(pkg)}`); continue; }
    blocking.set(id, { pkg, sev: via.severity });
  }
}

if (blocking.size > 0) {
  console.error("❌ Security audit failed — high/critical advisories not on the allowlist:");
  for (const [id, { pkg, sev }] of blocking) {
    console.error(`   - ${pkg} [${sev}]  https://github.com/advisories/${id}`);
  }
  console.error("\nFix them, or (only if genuinely non-actionable) add to scripts/check-audit.mjs with justification.");
  process.exit(1);
}

if (ignored.size > 0) {
  console.log("⚠️  Ignored allowlisted high/critical advisories (assessed non-actionable):");
  for (const [id, reason] of ignored) console.log(`   - ${id}: ${reason}`);
}
console.log("✅ Security audit passed.");
