import "server-only";
import { z } from "zod";
import { AuthError, requestIp, requireActionUser, type Permission, type SessionUser } from "./auth";

export interface ActionState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  /** Free-form payload (e.g. a preview). */
  data?: unknown;
}

export const initialState: ActionState = { ok: false, message: "" };

export class UserError extends Error {}

/**
 * Wraps a server action with authentication, authorisation and error handling.
 * Next.js already verifies the Origin header of Server Action requests (CSRF),
 * and the session cookie is SameSite=Strict.
 */
export function adminAction<T>(perm: Permission, fn: (ctx: { user: SessionUser; ip: string }, form: FormData) => Promise<ActionState | T>) {
  return async (_prev: ActionState, form: FormData): Promise<ActionState> => {
    try {
      const user = await requireActionUser(perm);
      const ip = await requestIp();
      const res = await fn({ user, ip }, form);
      return res && typeof res === "object" && "ok" in (res as object) ? (res as ActionState) : { ok: true, message: "Saved." };
    } catch (e) {
      if (e instanceof AuthError || e instanceof UserError) return { ok: false, message: e.message };
      if (e instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of e.issues) fieldErrors[issue.path.join(".") || "_"] = issue.message;
        return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };
      }
      // Re-throw Next.js control-flow errors (redirect/notFound).
      if (e && typeof e === "object" && "digest" in e && typeof (e as { digest: unknown }).digest === "string" && /NEXT_/.test((e as { digest: string }).digest)) throw e;
      console.error("[admin action]", e);
      return { ok: false, message: "Something went wrong. The error was logged." };
    }
  };
}

export const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
export const bool = (form: FormData, key: string) => form.get(key) === "on" || form.get(key) === "true";
export const json = <T,>(form: FormData, key: string, fallback: T): T => {
  const raw = form.get(key);
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new UserError(`Invalid data in field "${key}".`);
  }
};
/** Empty string → null (meaning "use the default"). */
export const opt = (form: FormData, key: string, max = 5000): string | null => {
  const v = str(form, key);
  if (v.length > max) throw new UserError(`"${key}" is too long (max ${max} characters).`);
  return v === "" ? null : v;
};

