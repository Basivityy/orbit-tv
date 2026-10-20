import { headers } from "next/headers";
import { z } from "zod";
import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/errors";

const schema = z.object({ message: z.string().max(1000), stack: z.string().max(4000).optional(), path: z.string().max(300).optional() });

export async function POST(req: Request) {
  const h = await headers();
  if (!rateLimit(`err:${clientIp(h)}`, 10, 60_000).ok) return new Response(null, { status: 204 });
  if (Number(h.get("content-length") ?? 0) > 8192) return new Response(null, { status: 413 });
  try {
    const parsed = schema.safeParse(JSON.parse(await req.text()));
    if (parsed.success) await logError("client", parsed.data.message, { stack: parsed.data.stack, path: parsed.data.path, userAgent: h.get("user-agent") ?? undefined });
  } catch {
    /* ignore */
  }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
