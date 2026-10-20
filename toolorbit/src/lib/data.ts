import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { prisma, isBuildPhase } from "./db";
import { CATEGORY_BY_ID } from "@/tools/categories";
import type { CategoryId } from "@/tools/types";
import { buildCatalog, type Catalog, type ResolvedCategory, type ResolvedTool } from "./data-catalog";

export { buildCatalog };
export type { Catalog, InternalLink, ResolvedCategory, ResolvedTool } from "./data-catalog";
import { SETTING_DEFAULTS, type AllSettings, type SettingKey } from "./settings-schema";
import { DEFAULT_PAGES, fillPlaceholders } from "./default-pages";
import { SITE_URL } from "./env";

/**
 * Public data layer.
 *
 * Every public page reads the catalog, settings and pages through tag-based
 * caches ("catalog", "settings", "pages"). The database is queried once per
 * tag until an admin change calls revalidateTag(), so traffic spikes do not
 * translate into database load.
 */

export const TAGS = { catalog: "catalog", settings: "settings", pages: "pages", redirects: "redirects" } as const;
const REVALIDATE_SECONDS = 3600;

async function readSettingsFromDb(): Promise<AllSettings> {
  const rows = await prisma.setting.findMany();
  const out = {} as Record<SettingKey, unknown>;
  for (const key of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
    const def = SETTING_DEFAULTS[key];
    const row = rows.find((r) => r.key === key);
    const parsed = row ? def.schema.safeParse({ ...def.value, ...(row.value as object) }) : null;
    out[key] = parsed?.success ? parsed.data : def.value;
  }
  return out as unknown as AllSettings;
}

function defaultSettings(): AllSettings {
  return Object.fromEntries(Object.entries(SETTING_DEFAULTS).map(([k, v]) => [k, v.value])) as unknown as AllSettings;
}

const cachedSettings = unstable_cache(readSettingsFromDb, ["settings-v1"], { tags: [TAGS.settings], revalidate: REVALIDATE_SECONDS });

const cachedCatalog = unstable_cache(
  async (siteName: string) => {
    const [overrides, seoRows, categoryRows] = await Promise.all([prisma.toolOverride.findMany(), prisma.toolSeo.findMany(), prisma.categoryOverride.findMany()]);
    return buildCatalog(overrides, seoRows, categoryRows, siteName);
  },
  ["catalog-v1"],
  { tags: [TAGS.catalog, TAGS.settings], revalidate: REVALIDATE_SECONDS },
);

export interface PublicPage {
  slug: string;
  title: string;
  body: string;
  metaDescription: string;
  updatedAt: string | null;
}

const cachedPages = unstable_cache(
  async () => {
    const rows = await prisma.sitePage.findMany();
    return rows.map((r) => ({ slug: r.slug, title: r.title, body: r.body, metaDescription: r.metaDescription ?? "", published: r.published, updatedAt: r.updatedAt.toISOString() }));
  },
  ["pages-v1"],
  { tags: [TAGS.pages], revalidate: REVALIDATE_SECONDS },
);

function logDataError(what: string, e: unknown) {
  console.error(`[data] Failed to load ${what}; serving defaults.`, e instanceof Error ? e.message : e);
}

/** Settings with safe fallback to defaults (build time or database outage). */
export const getSettings = cache(async (): Promise<AllSettings> => {
  if (isBuildPhase()) return defaultSettings();
  try {
    return await cachedSettings();
  } catch (e) {
    logDataError("settings", e);
    return defaultSettings();
  }
});

export const getCatalog = cache(async (): Promise<Catalog> => {
  const settings = await getSettings();
  if (isBuildPhase()) return buildCatalog([], [], [], settings.site.name);
  try {
    return await cachedCatalog(settings.site.name);
  } catch (e) {
    logDataError("catalog", e);
    return buildCatalog([], [], [], settings.site.name);
  }
});

export async function getActiveTools(): Promise<ResolvedTool[]> {
  return (await getCatalog()).tools.filter((t) => t.enabled);
}

export async function getToolBySlug(slug: string): Promise<ResolvedTool | undefined> {
  return (await getCatalog()).tools.find((t) => t.slug === slug && t.enabled);
}

export async function getCategoryBySlug(slug: string): Promise<ResolvedCategory | undefined> {
  return (await getCatalog()).categories.find((c) => c.slug === slug);
}

export function categoryOf(cat: Catalog, id: CategoryId): ResolvedCategory {
  return cat.categories.find((c) => c.id === id) ?? { ...CATEGORY_BY_ID[id], seoTitle: CATEGORY_BY_ID[id].name, metaDescription: CATEGORY_BY_ID[id].description };
}

export async function getPage(slug: string): Promise<PublicPage | null> {
  const def = DEFAULT_PAGES.find((p) => p.slug === slug);
  let row: Awaited<ReturnType<typeof cachedPages>>[number] | undefined;
  if (!isBuildPhase()) {
    try {
      row = (await cachedPages()).find((p) => p.slug === slug);
    } catch (e) {
      logDataError("pages", e);
    }
  }
  if (row && !row.published) return null;
  const src = row ?? (def ? { ...def, updatedAt: null } : null);
  if (!src) return null;
  const settings = await getSettings();
  const tools = await getActiveTools();
  const vars = {
    siteName: settings.site.name,
    contactEmail: settings.site.contactEmail,
    siteUrl: SITE_URL,
    toolCount: String(tools.length),
    date: new Date(src.updatedAt ?? Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  };
  return {
    slug,
    title: fillPlaceholders(src.title, vars),
    body: fillPlaceholders(src.body, vars),
    metaDescription: fillPlaceholders(src.metaDescription ?? "", vars),
    updatedAt: src.updatedAt,
  };
}

export const STATIC_PAGE_SLUGS = DEFAULT_PAGES.map((p) => p.slug);

/** Lightweight index used by the client-side search. */
export async function getSearchIndex() {
  const cat = await getCatalog();
  return cat.tools
    .filter((t) => t.enabled && t.searchVisible)
    .map((t) => ({ id: t.id, s: t.slug, n: t.name, c: t.category, i: t.icon, d: t.description, k: t.keywords.join(" "), p: t.popular ? 1 : 0 }));
}
