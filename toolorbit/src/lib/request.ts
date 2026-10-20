import "server-only";
import { TRUST_PROXY } from "./env";

/** Best-effort client IP. nginx overwrites X-Real-IP with the verified client address. */
export function clientIp(h: Headers): string {
  if (TRUST_PROXY) {
    const real = h.get("x-real-ip");
    if (real) return real.trim();
    const fwd = h.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
  }
  return "unknown";
}
