// Sign-up abuse guards — pure helpers shared by the register action and the profile
// editor. No server-only imports, so the client form can reuse the same rules.
//
// Why this exists: bots were registering with a throwaway inbox and stuffing link spam
// into the optional Name field ("*** <a href=…>$3,222 payment available</a> *** hs=…").
// The name was stored unvalidated, so the junk landed in the admin Users table and each
// sign-up spent a welcome email. A display name is a NAME: no links, markup or symbols.

export const DISPLAY_NAME_MAX = 60;

export const DISPLAY_NAME_ERROR =
  "Please enter just your name — letters only, no links or symbols.";

// Letters/marks from any script, digits after the first character, and the punctuation
// real names use (space . , ' ’ -). Everything a link or markup needs — / : < > = ? & @ * $ _ —
// is outside this set.
const NAME_CHARSET = /^[\p{L}\p{M}][\p{L}\p{M}\p{N} .,'’-]*$/u;

// Bare domains survive the charset ("myxa.cc"), so catch dot-TLD shapes explicitly.
// A fixed TLD list (not a generic \.[a-z]{2,}) keeps "St.John" / "Dr.Amara" valid.
const DOMAIN_LIKE =
  /[\p{L}\p{N}-]{2,}\.(com|net|org|info|biz|ru|cn|cc|in|io|co|xyz|top|site|online|shop|club|link|click|live|me|us|uk|de|fr|nl|pl|br|php|html?)\b/iu;

const LINK_WORDS = /\b(https?|www|href)\b/i;

export type DisplayNameResult =
  | { ok: true; name: string | null }
  | { ok: false; error: string };

/**
 * Normalise and validate an optional display name. Empty input is valid (name stays
 * null). Returns the cleaned name, or an error safe to show to the user.
 */
export function validateDisplayName(raw: unknown): DisplayNameResult {
  if (raw == null) return { ok: true, name: null };
  if (typeof raw !== "string") return { ok: false, error: DISPLAY_NAME_ERROR };
  const name = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!name) return { ok: true, name: null };
  if (name.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `Name is too long (max ${DISPLAY_NAME_MAX} characters).` };
  }
  if (!NAME_CHARSET.test(name) || DOMAIN_LIKE.test(name) || LINK_WORDS.test(name)) {
    return { ok: false, error: DISPLAY_NAME_ERROR };
  }
  return { ok: true, name };
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Basic shape + length check. Not RFC-complete on purpose — just rejects obvious junk. */
export function isPlausibleEmail(email: string | null | undefined): email is string {
  return !!email && email.length <= 254 && EMAIL_SHAPE.test(email);
}

// Throwaway-inbox providers. Extend this list when a new one shows up in Admin → Users;
// subdomains of each entry are blocked too.
export const DISPOSABLE_EMAIL_DOMAINS: readonly string[] = [
  "merepost.com", "fextemp.com",            // seen in the Oct–Nov 2026 spam sign-ups
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "guerrillamail.info", "guerrillamailblock.com", "sharklasers.com", "grr.la",
  "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org", "temp-mail.io",
  "tempmail.net", "tempmailo.com", "tempail.com", "tempr.email", "tempinbox.com",
  "tmpmail.org", "tmpmail.net", "mytemp.email", "yopmail.com", "yopmail.net", "yopmail.fr",
  "trashmail.com", "trashmail.net", "throwawaymail.com", "getnada.com", "nada.email",
  "dispostable.com", "discard.email", "maildrop.cc", "mohmal.com", "moakt.com",
  "emailondeck.com", "fakeinbox.com", "mailnesia.com", "mailcatch.com", "mintemail.com",
  "spamgourmet.com", "harakirimail.com", "inboxkitten.com", "burnermail.io",
  "1secmail.com", "1secmail.net", "1secmail.org", "emailfake.com", "fakemail.net",
  "getairmail.com", "mailsac.com", "spam4.me", "tempmailaddress.com", "luxusmail.org",
];

/** True when the address belongs to a known throwaway-inbox provider. */
export function isDisposableEmail(email: string | null | undefined): boolean {
  const domain = email?.split("@").pop()?.toLowerCase().trim();
  if (!domain) return false;
  return DISPOSABLE_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith("." + d));
}

/** Name of the hidden honeypot input on the register form. People never see or fill it. */
export const HONEYPOT_FIELD = "company_website";
