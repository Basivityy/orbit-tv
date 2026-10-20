import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminUser, Role } from "@prisma/client";
import { prisma } from "./db";
import { IS_PROD } from "./env";
import { clientIp } from "./request";

/**
 * Admin authentication.
 * - Passwords: Argon2id (OWASP parameters: m=19 MiB, t=2, p=1).
 * - Sessions: 256-bit random token in an HttpOnly, Secure, SameSite=Strict cookie;
 *   only its SHA-256 hash is stored, so a database leak does not expose live sessions.
 * - CSRF: mutations use Server Actions (Origin/Host verified by Next.js) and the
 *   SameSite=Strict cookie is never sent on cross-site requests.
 */

export const SESSION_COOKIE = IS_PROD ? "__Host-to_admin" : "to_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_RENEW_MS = 60 * 60 * 1000;
export const MAX_FAILED_LOGINS = 8;
export const LOCK_MINUTES = 15;

export const ROLE_RANK: Record<Role, number> = { VIEWER: 0, EDITOR: 1, ADMIN: 2, OWNER: 3 };

/** What each role may do. */
export const PERMISSIONS = {
  viewDashboard: "VIEWER",
  editSeo: "EDITOR",
  editContent: "EDITOR",
  manageTools: "ADMIN",
  manageAds: "ADMIN",
  manageRedirects: "ADMIN",
  viewAudit: "ADMIN",
  manageUsers: "OWNER",
} as const satisfies Record<string, Role>;
export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, perm: Permission): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[PERMISSIONS[perm]];
}

export { hashPassword, validatePasswordStrength, verifyPassword } from "./password";

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  await prisma.session.create({
    data: { tokenHash: tokenHash(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS), ip: clientIp(h), userAgent: h.get("user-agent")?.slice(0, 300) },
  });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: IS_PROD, sameSite: "strict", path: "/", maxAge: SESSION_TTL_MS / 1000 });
  // Opportunistic cleanup of expired sessions.
  void prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => undefined);
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: tokenHash(token) } }).catch(() => undefined);
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = Pick<AdminUser, "id" | "email" | "name" | "role">;

/** Current admin user (deduplicated per request). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  // Sliding expiration, refreshed at most once an hour.
  if (session.expiresAt.getTime() - Date.now() < SESSION_TTL_MS - SESSION_RENEW_MS) {
    await prisma.session.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) } }).catch(() => undefined);
  }
  const { id, email, name, role } = session.user;
  return { id, email, name, role };
});

/** For pages: redirects to login when unauthenticated, 403 page when lacking permission. */
export async function requirePageUser(perm: Permission = "viewDashboard"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (!can(user.role, perm)) redirect("/admin?denied=1");
  return user;
}

export class AuthError extends Error {}

/** For server actions: throws instead of redirecting. */
export async function requireActionUser(perm: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Your session has expired. Please sign in again.");
  if (!can(user.role, perm)) throw new AuthError("You don't have permission to do that.");
  return user;
}

export async function requestIp(): Promise<string> {
  return clientIp(await headers());
}
