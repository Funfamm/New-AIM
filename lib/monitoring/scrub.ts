import "server-only";

// PII / secret scrubbing applied at capture time so the error store never holds
// raw credentials or personal data. Conservative by design — it targets known
// secret shapes and sensitive key names, and avoids blanket high-entropy redaction
// that would clobber useful diagnostics (deploy ids, minified frame names, hashes).

const JWT     = /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g;
const BEARER  = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const AWS_KEY = /\bAKIA[0-9A-Z]{16}\b/g;
const STRIPE  = /\b[sr]k_(live|test)_[A-Za-z0-9]{10,}\b/g;
const GOOGLE  = /\bAIza[0-9A-Za-z_-]{20,}\b/g;
// key=value / key: value where the key is sensitive (query strings, headers, logs).
const ASSIGN  = /\b(pass(?:word|wd)?|pwd|secret|token|api[_-]?key|apikey|authorization|access[_-]?token|refresh[_-]?token|client[_-]?secret|set-cookie|cookie|session(?:[_-]?id)?)\b(\s*["']?\s*[:=]\s*["']?)([^"'&\s,;}]{3,})/gi;
const EMAIL   = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function scrubText(input: string): string {
  if (!input) return input;
  return input
    .replace(JWT,     "[jwt]")
    .replace(BEARER,  (_m, scheme) => `${scheme} [redacted]`)
    .replace(AWS_KEY, "[aws-key]")
    .replace(STRIPE,  "[stripe-key]")
    .replace(GOOGLE,  "[google-key]")
    .replace(ASSIGN,  (_m, key, sep) => `${key}${sep}[redacted]`)
    .replace(EMAIL,   "[email]");
}

const SENSITIVE_KEY = /(pass(word|wd)?|pwd|secret|token|api[_-]?key|apikey|authorization|auth|cookie|session|credential|private[_-]?key)/i;

// Recursively scrub a JSON-ish value: redact values under sensitive keys, scrub
// string leaves, and bound depth/size so a pathological payload can't blow up.
export function scrubJson(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth-limited]";
  if (typeof value === "string") return scrubText(value);
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => scrubJson(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : scrubJson(v, depth + 1);
    }
    return out;
  }
  return value;
}
