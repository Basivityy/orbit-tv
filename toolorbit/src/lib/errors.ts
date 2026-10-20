import "server-only";
import { prisma } from "./db";

const g = globalThis as unknown as { __errBudget?: { windowStart: number; count: number } };

/** Records an error with a global budget (max 60/minute) so error storms can't overload the database. */
export async function logError(source: "client" | "server", message: string, extra: { stack?: string; path?: string; userAgent?: string } = {}) {
  const now = Date.now();
  const b = (g.__errBudget ??= { windowStart: now, count: 0 });
  if (now - b.windowStart > 60_000) {
    b.windowStart = now;
    b.count = 0;
  }
  if (++b.count > 60) return;
  const msg = message.slice(0, 500);
  try {
    const since = new Date(now - 60 * 60_000);
    const existing = await prisma.errorLog.findFirst({ where: { source, message: msg, path: extra.path ?? null, createdAt: { gte: since } }, select: { id: true } });
    if (existing) {
      await prisma.errorLog.update({ where: { id: existing.id }, data: { count: { increment: 1 }, lastSeen: new Date() } });
    } else {
      await prisma.errorLog.create({ data: { source, message: msg, stack: extra.stack?.slice(0, 4000), path: extra.path?.slice(0, 300), userAgent: extra.userAgent?.slice(0, 300) } });
    }
  } catch {
    /* never throw from the error logger */
  }
}
