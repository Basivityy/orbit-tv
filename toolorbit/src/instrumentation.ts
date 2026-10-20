import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { flushAnalytics } = await import("./lib/analytics");
  const shutdown = async () => {
    await flushAnalytics().catch(() => undefined);
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
}

export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logError } = await import("./lib/errors");
  const e = err as Error & { digest?: string };
  await logError("server", e.message || String(err), { stack: e.stack, path: request.path, userAgent: request.headers["user-agent"] as string | undefined });
};
