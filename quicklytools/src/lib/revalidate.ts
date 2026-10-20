import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { TAGS } from "./data";
import { SITE_URL } from "./env";

/**
 * Cache invalidation after admin changes:
 *  1. Next.js data cache tags → pages re-render with new data on next request.
 *  2. Cloudflare edge cache purge (optional, when CF_API_TOKEN + CF_ZONE_ID are set)
 *     so search engines and visitors get the new HTML immediately.
 */

async function purgeCloudflare(body: { files?: string[]; purge_everything?: boolean }) {
  const token = process.env.CF_API_TOKEN;
  const zone = process.env.CF_ZONE_ID;
  if (!token || !zone) return;
  try {
    const chunks = body.files ? Array.from({ length: Math.ceil(body.files.length / 30) }, (_, i) => ({ files: body.files!.slice(i * 30, i * 30 + 30) })) : [body];
    for (const chunk of chunks) {
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone)}/purge_cache`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(chunk),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) console.error("[cloudflare] purge failed", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("[cloudflare] purge error", e instanceof Error ? e.message : e);
  }
}

/** Tool/category/SEO changes. `paths` are the public URLs affected (e.g. old and new tool URL). */
export async function revalidateCatalog(paths: string[] = []) {
  revalidateTag(TAGS.catalog);
  const all = [...new Set(["/", "/tools", "/sitemap.xml", "/search-index.json", ...paths])];
  for (const p of all) revalidatePath(p);
  await purgeCloudflare({ files: all.map((p) => `${SITE_URL}${p}`) });
}

/** Site-wide settings (navigation, footer, ads, site name) affect every page. */
export async function revalidateEverything() {
  revalidateTag(TAGS.settings);
  revalidateTag(TAGS.catalog);
  revalidateTag(TAGS.pages);
  revalidatePath("/", "layout");
  revalidatePath("/ads.txt");
  await purgeCloudflare({ purge_everything: true });
}

export async function revalidatePages(slug: string) {
  revalidateTag(TAGS.pages);
  revalidatePath(`/${slug}`);
  await purgeCloudflare({ files: [`${SITE_URL}/${slug}`] });
}
