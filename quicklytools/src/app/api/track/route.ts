import { headers } from "next/headers";
import { z } from "zod";
import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { TOOL_BY_ID } from "@/tools/registry";

const schema = z.object({ kind: z.enum(["view", "use"]), key: z.string().min(1).max(120) });
const PAGE_KEY = /^\/[a-z0-9\-/]{0,100}$/;

/** Anonymous aggregate counters. Accepts only known tool ids or simple site paths. */
export async function POST(req: Request) {
  const h = await headers();
  if (!rateLimit(`track:${clientIp(h)}`, 120, 60_000).ok) return new Response(null, { status: 204 });
  const len = Number(h.get("content-length") ?? 0);
  if (len > 1024) return new Response(null, { status: 413 });
  try {
    const parsed = schema.safeParse(JSON.parse(await req.text()));
    if (parsed.success) {
      const { kind, key } = parsed.data;
      if (TOOL_BY_ID.has(key) || (kind === "view" && PAGE_KEY.test(key))) track(kind, key);
    }
  } catch {
    /* ignore malformed beacons */
  }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
