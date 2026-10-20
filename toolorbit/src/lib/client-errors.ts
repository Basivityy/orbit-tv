"use client";

let sent = 0;

/** Sends a trimmed client error report (max 5 per page load). Never throws. */
export function reportClientError(err: unknown, context?: string) {
  if (typeof window === "undefined" || sent >= 5) return;
  sent++;
  try {
    const e = err instanceof Error ? err : new Error(String(err));
    const body = JSON.stringify({
      message: `${context ? `[${context}] ` : ""}${e.message}`.slice(0, 500),
      stack: (e.stack ?? "").slice(0, 2000),
      path: location.pathname,
    });
    navigator.sendBeacon?.("/api/report-error", new Blob([body], { type: "application/json" }));
  } catch {
    /* ignore */
  }
}
