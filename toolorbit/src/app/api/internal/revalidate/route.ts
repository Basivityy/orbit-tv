import { timingSafeEqual } from "node:crypto";
import { revalidateEverything } from "@/lib/revalidate";

/**
 * Called by the container entrypoint after start-up (and usable by ops scripts)
 * to refresh pages prerendered at build time with live database data.
 * Protected by INTERNAL_API_SECRET; nginx also blocks /api/internal from outside.
 */
export async function POST(req: Request) {
  const secret = process.env.INTERNAL_API_SECRET || "";
  const given = req.headers.get("x-internal-secret") || "";
  const ok = secret.length >= 32 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return new Response("Forbidden", { status: 403 });
  await revalidateEverything();
  return Response.json({ revalidated: true }, { headers: { "cache-control": "no-store" } });
}
