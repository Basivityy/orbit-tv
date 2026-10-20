import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + readiness probe for Docker, nginx and uptime monitors. */
export async function GET() {
  const started = Date.now();
  let db = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }
  const body = { status: db === "ok" ? "ok" : "degraded", db, uptime: Math.round(process.uptime()), responseMs: Date.now() - started, version: process.env.APP_VERSION || "dev" };
  return Response.json(body, { status: db === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } });
}
