import "server-only";
import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96-bit IV — GCM standard

function getDerivedKey(): Buffer {
  const secret = process.env.TRANSLATION_KEY_ENCRYPTION_SECRET;
  if (!secret) throw new Error("TRANSLATION_KEY_ENCRYPTION_SECRET is not set");
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a raw API key string.
 * Output format: "<ivHex>:<authTagHex>:<ciphertextHex>"
 * Never store the raw key — only the ciphertext returned here.
 */
export function encryptSecret(raw: string): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a ciphertext produced by encryptSecret().
 * Throws if the key is wrong or the ciphertext is corrupt.
 */
export function decryptSecret(ciphertext: string): string {
  const key = getDerivedKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
  const [ivHex, tagHex, encHex] = parts;
  const iv  = Buffer.from(ivHex,  "hex");
  const tag = Buffer.from(tagHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString("utf8") + decipher.final("utf8");
}

/**
 * Returns a display-safe preview of a raw key ("...lastEightChars").
 * Never pass this the ciphertext — pass the raw key.
 */
export function maskSecret(raw: string): string {
  if (!raw || raw.length <= 8) return "...";
  return `...${raw.slice(-8)}`;
}
