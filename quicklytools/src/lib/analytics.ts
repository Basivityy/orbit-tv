import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";

/**
 * Aggregated analytics without per-request database writes.
 * Increments are buffered in memory and flushed in one batched UPSERT every
 * FLUSH_MS. No IPs, cookies or identifiers are stored — only daily totals.
 */
const FLUSH_MS = 30_000;
const MAX_KEYS = 5_000;

type Kind = "view" | "use";
interface State {
  buf: Map<string, number>;
  timer?: NodeJS.Timeout;
  flushing?: Promise<void>;
}
const g = globalThis as unknown as { __an?: State };
const state: State = (g.__an ??= { buf: new Map() });

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function track(kind: Kind, key: string) {
  const k = `${today()}|${kind}|${key}`;
  if (!state.buf.has(k) && state.buf.size >= MAX_KEYS) return; // protect memory against key flooding
  state.buf.set(k, (state.buf.get(k) ?? 0) + 1);
  if (!state.timer) {
    state.timer = setInterval(() => void flushAnalytics(), FLUSH_MS);
    state.timer.unref?.();
  }
}

export async function flushAnalytics(): Promise<void> {
  if (state.flushing) return state.flushing;
  if (state.buf.size === 0) return;
  const entries = [...state.buf.entries()];
  state.buf.clear();
  state.flushing = (async () => {
    try {
      const values = entries.map(([k, n]) => {
        const [date, kind, key] = k.split("|");
        return Prisma.sql`(${date}::date, ${kind}, ${key}, ${n})`;
      });
      await prisma.$executeRaw`
        INSERT INTO "DailyStat" ("date", "kind", "key", "count")
        VALUES ${Prisma.join(values)}
        ON CONFLICT ("date", "kind", "key") DO UPDATE SET "count" = "DailyStat"."count" + EXCLUDED."count"`;
    } catch (e) {
      // Put counts back so they are retried on the next flush.
      for (const [k, n] of entries) state.buf.set(k, (state.buf.get(k) ?? 0) + n);
      console.error("[analytics] flush failed", e instanceof Error ? e.message : e);
    } finally {
      state.flushing = undefined;
    }
  })();
  return state.flushing;
}
