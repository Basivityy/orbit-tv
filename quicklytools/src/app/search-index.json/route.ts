import { getSearchIndex } from "@/lib/data";

export const revalidate = 3600;

export async function GET() {
  return Response.json(await getSearchIndex(), {
    headers: { "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
