import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { resolveSecret } from "../config/secrets.js";

/**
 * Keeps a staff user's password so the admin can look it up in the ERP (login still checks the bcrypt hash).
 * AES-256-GCM, with the key derived from JWT_ACCESS_SECRET; if that secret changes, older passwords simply read as unknown.
 */
const VERSION = "v1";

function vaultKey() {
  const secret = resolveSecret("JWT_ACCESS_SECRET", {
    value: process.env.JWT_ACCESS_SECRET,
    devFallback: "dev-access-secret"
  });
  return createHash("sha256").update(`staff-password-vault:${secret}`).digest();
}

export function encryptStaffPassword(password: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return `${VERSION}:${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64")}`;
}

/** The kept password, or null when none is kept or it can no longer be read. */
export function decryptStaffPassword(stored: string | null | undefined): string | null {
  if (!stored?.startsWith(`${VERSION}:`)) return null;
  try {
    const data = Buffer.from(stored.slice(VERSION.length + 1), "base64");
    const decipher = createDecipheriv("aes-256-gcm", vaultKey(), data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
