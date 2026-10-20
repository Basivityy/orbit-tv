import type { MetadataRoute } from "next";
import { getCatalog, STATIC_PAGE_SLUGS } from "@/lib/data";
import { absoluteUrl } from "@/lib/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await getCatalog();
  const now = new Date();
  const tools = catalog.tools.filter((t) => t.enabled && t.seo.robotsIndex && !t.seo.canonical);
  const usedCats = new Set(tools.map((t) => t.category));
  return [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/tools"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...catalog.categories.filter((c) => usedCats.has(c.id)).map((c) => ({ url: absoluteUrl(`/category/${c.slug}`), lastModified: now, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...tools.map((t) => ({ url: absoluteUrl(`/tools/${t.slug}`), lastModified: now, changeFrequency: "monthly" as const, priority: t.popular ? 0.9 : 0.7 })),
    ...STATIC_PAGE_SLUGS.map((s) => ({ url: absoluteUrl(`/${s}`), lastModified: now, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
}
