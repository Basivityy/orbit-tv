/** Password hashing (Argon2id, OWASP-recommended parameters). No Next.js imports so CLI scripts can use it. */
import { hash, verify } from "@node-rs/argon2";

export const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32, algorithm: 2 as const };

export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 12) return "Password must be at least 12 characters.";
  if (pw.length > 256) return "Password is too long.";
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes < 3) return "Use at least three of: lowercase, uppercase, digits, symbols.";
  return null;
}

export const hashPassword = (pw: string) => hash(pw, ARGON_OPTS);

let dummyHash: Promise<string> | null = null;

/** Verifies a password. With no stored hash, burns comparable time to avoid user enumeration. */
export async function verifyPassword(stored: string | null, pw: string): Promise<boolean> {
  if (!stored) {
    dummyHash ??= hash("dummy-password-for-timing", ARGON_OPTS);
    await verify(await dummyHash, pw).catch(() => false);
    return false;
  }
  try {
    return await verify(stored, pw);
  } catch {
    return false;
  }
}
