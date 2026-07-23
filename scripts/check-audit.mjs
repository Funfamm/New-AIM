// CI security-audit gate with a documented allowlist.
//
// Fails on ANY high/critical advisory EXCEPT a small set we've individually assessed as
// non-actionable for THIS app and cannot fix without breaking a framework's pinned
// transitive dependency. Every other high/critical still fails the build — this is
// strictly narrower than silencing the gate (e.g. `--audit-level=critical`), which would
// let future high runtime vulns through unnoticed.
//
// Reads audit.json produced by `npm audit --json`.
import { readFileSync } from "node:fs";

// Allowlisted advisories — keep this list SHORT, specific, and justified. Re-review on
// every dependency bump; delete entries the moment an upstream fix lands.
const ALLOW = new Map([
  // PostCSS advisories reachable only through Next.js's pinned transitive postcss@8.4.31.
  // Both are BUILD-TIME only: postcss runs on our own CSS during `next build`, never on
  // untrusted runtime input, so there is no runtime attack surface for the deployed app.
  // Remove once Next bumps its postcss pin above 8.5.11 (npm overrides can't reach it).
  ["GHSA-qx2v-qp2m-jg93", "PostCSS XSS in CSS stringify — build-time only (next→postcss)"],
  ["GHSA-6g55-p6wh-862q", "PostCSS file-read via sourceMappingURL — build-time only (next→postcss)"],
]);

const BLOCKING = new Set(["high", "critical"]);

const report = JSON.parse(readFileSync("audit.json", "utf8"));
const found = new Set();
for (const v of Object.values(report.vulnerabilities ?? {})) {
  if (!BLOCKING.has(v.severity)) continue;
  for (const via of v.via ?? []) {
    if (via && typeof via === "object" && via.url) found.add(via.url.split("/").pop());
  }
}

const blocking = [...found].filter((id) => !ALLOW.has(id));

if (blocking.length > 0) {
  console.error("❌ Security audit failed — high/critical advisories not on the allowlist:");
  for (const id of blocking) console.error(`   - https://github.com/advisories/${id}`);
  console.error("\nFix them, or (only if genuinely non-actionable) add to scripts/check-audit.mjs with justification.");
  process.exit(1);
}

const ignored = [...found].filter((id) => ALLOW.has(id));
if (ignored.length > 0) {
  console.log("⚠️  Ignored allowlisted high/critical advisories (assessed non-actionable):");
  for (const id of ignored) console.log(`   - ${id}: ${ALLOW.get(id)}`);
}
console.log("✅ Security audit passed.");
