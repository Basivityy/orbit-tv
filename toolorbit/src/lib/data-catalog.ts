/** Pure catalog builder: merges code defaults with admin overrides. No server-only imports (unit-testable). */
import type { CategoryOverride, ToolOverride, ToolSeo } from "@prisma/client";
import { TOOL_DEFINITIONS } from "@/tools/registry";
import { CATEGORIES, isCategoryId } from "@/tools/categories";
import type { CategoryId, FaqItem, ProcessingMode } from "@/tools/types";

export interface InternalLink {
  label: string;
  href: string;
}

export interface ResolvedTool {
  id: string;
  slug: string;
  name: string;
  category: CategoryId;
  implCategory: CategoryId;
  icon: string;
  description: string;
  enabled: boolean;
  popular: boolean;
  order: number;
  searchVisible: boolean;
  related: string[];
  processing: ProcessingMode;
  keywords: string[];
  steps: string[];
  notes: string[];
  seo: {
    title: string;
    metaDescription: string;
    canonical: string | null;
    robotsIndex: boolean;
    robotsFollow: boolean;
    ogTitle: string;
    ogDescription: string;
    ogImage: string | null;
    twitterTitle: string;
    twitterDescription: string;
    twitterImage: string | null;
    twitterCard: "summary" | "summary_large_image";
    h1: string;
    intro: string;
    body: string | null;
    faq: FaqItem[];
    internalLinks: InternalLink[];
    structuredData: boolean;
  };
}

export interface ResolvedCategory {
  id: CategoryId;
  slug: string;
  name: string;
  icon: string;
  description: string;
  intro: string;
  seoTitle: string;
  metaDescription: string;
  order: number;
}

export interface Catalog {
  tools: ResolvedTool[];
  categories: ResolvedCategory[];
}

function asFaq(v: unknown): FaqItem[] | null {
  if (!Array.isArray(v)) return null;
  const items = v.filter((x): x is FaqItem => !!x && typeof x.q === "string" && typeof x.a === "string" && x.q.trim() !== "" && x.a.trim() !== "");
  return items;
}

function asLinks(v: unknown): InternalLink[] | null {
  if (!Array.isArray(v)) return null;
  return v.filter((x): x is InternalLink => !!x && typeof x.label === "string" && typeof x.href === "string");
}

type OverrideRow = ToolOverride;
type SeoRow = ToolSeo;
type CategoryRow = CategoryOverride;

export function buildCatalog(overrides: OverrideRow[], seoRows: SeoRow[], categoryRows: CategoryRow[], siteName: string): Catalog {
  const ov = new Map(overrides.map((o) => [o.toolId, o]));
  const seo = new Map(seoRows.map((s) => [s.toolId, s]));
  const catOv = new Map(categoryRows.map((c) => [c.categoryId, c]));

  const categories: ResolvedCategory[] = CATEGORIES.map((c) => {
    const o = catOv.get(c.id);
    return {
      id: c.id,
      slug: c.slug,
      name: o?.name || c.name,
      icon: c.icon,
      description: o?.description || c.description,
      intro: o?.intro || c.intro,
      seoTitle: o?.seoTitle || `${o?.name || c.name} – Free Online ${o?.name || c.name}`,
      metaDescription: o?.metaDescription || o?.description || c.description,
      order: o?.sortOrder ?? c.order,
    };
  }).sort((a, b) => a.order - b.order);

  const tools: ResolvedTool[] = TOOL_DEFINITIONS.map((d, index) => {
    const o = ov.get(d.id);
    const s = seo.get(d.id);
    const name = o?.name || d.name;
    const description = o?.description || d.summary;
    const category = o?.categoryId && isCategoryId(o.categoryId) ? o.categoryId : d.category;
    const title = s?.title || d.seoTitle || `${name} – Free Online Tool | ${siteName}`;
    const metaDescription = s?.metaDescription || description;
    return {
      id: d.id,
      slug: s?.slug || d.id,
      name,
      category,
      implCategory: d.category,
      icon: o?.icon || d.icon,
      description,
      enabled: o?.enabled ?? true,
      popular: o?.popular ?? !!d.popular,
      order: o?.sortOrder ?? index,
      searchVisible: o?.searchVisible ?? true,
      related: o?.hasRelated ? o.relatedIds : d.related,
      processing: d.processing,
      keywords: d.keywords,
      steps: d.steps,
      notes: d.notes,
      seo: {
        title,
        metaDescription,
        canonical: s?.canonical || null,
        robotsIndex: s?.robotsIndex ?? true,
        robotsFollow: s?.robotsFollow ?? true,
        ogTitle: s?.ogTitle || name,
        ogDescription: s?.ogDescription || metaDescription,
        ogImage: s?.ogImage || null,
        twitterTitle: s?.twitterTitle || s?.ogTitle || name,
        twitterDescription: s?.twitterDescription || s?.ogDescription || metaDescription,
        twitterImage: s?.twitterImage || s?.ogImage || null,
        twitterCard: (s?.twitterCard === "summary" ? "summary" : "summary_large_image") as "summary" | "summary_large_image",
        h1: s?.h1 || name,
        intro: s?.intro || d.intro,
        body: s?.body || null,
        faq: asFaq(s?.faq) ?? d.faq,
        internalLinks: asLinks(s?.internalLinks) ?? [],
        structuredData: s?.structuredData ?? true,
      },
    };
  }).sort((a, b) => a.order - b.order);

  return { tools, categories };
}

