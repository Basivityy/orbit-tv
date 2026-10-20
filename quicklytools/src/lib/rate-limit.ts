import "server-only";

/**
 * In-memory sliding-window rate limiter (per process).
 * nginx enforces coarse per-IP limits in front of the app as a first line of defence;
 * this limiter adds precise per-endpoint budgets. For multi-instance deployments,
 * swap the store for Redis (same interface).
 */
interface Bucket {
  prev: number;
  curr: number;
  windowStart: number;
}

const g = globalThis as unknown as { __rl?: Map<string, Bucket>; __rlSweep?: NodeJS.Timeout };
const store = (g.__rl ??= new Map());

if (!g.__rlSweep) {
  g.__rlSweep = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of store) if (now - b.windowStart > 10 * 60_000) store.delete(k);
  }, 60_000);
  g.__rlSweep.unref?.();
}

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfter: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  let b = store.get(key);
  if (!b) {
    b = { prev: 0, curr: 0, windowStart: now };
    store.set(key, b);
  }
  const elapsed = now - b.windowStart;
  if (elapsed >= windowMs) {
    const windows = Math.floor(elapsed / windowMs);
    b.prev = windows === 1 ? b.curr : 0;
    b.curr = 0;
    b.windowStart += windows * windowMs;
  }
  const weight = 1 - (now - b.windowStart) / windowMs;
  const estimated = b.prev * weight + b.curr;
  if (estimated >= limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((windowMs - (now - b.windowStart)) / 1000) };
  }
  b.curr++;
  return { ok: true, remaining: Math.max(0, Math.floor(limit - estimated - 1)), retryAfter: 0 };
}

export function resetRateLimit(key: string) {
  store.delete(key);
}

export function tooMany(r: RateResult): Response {
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": String(r.retryAfter), "cache-control": "no-store" },
  });
}
