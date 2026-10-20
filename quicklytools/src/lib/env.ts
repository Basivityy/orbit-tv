/** Centralised, validated environment access. */

function clean(url: string) {
  return url.replace(/\/+$/, "");
}

export const SITE_URL = clean(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
export const IS_PROD = process.env.NODE_ENV === "production";

/** Trust X-Real-IP / X-Forwarded-For from the reverse proxy (nginx). */
export const TRUST_PROXY = (process.env.TRUST_PROXY ?? "true") === "true";

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}
