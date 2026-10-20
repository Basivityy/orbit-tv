import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { TOOL_BY_ID, TOOL_DEFINITIONS } from "@/tools/registry";
import { UserError } from "./admin-action";

/** Editable per-tool SEO fields. `null` means "use the code default". */
export const SEO_FIELDS = {
  slug: { label: "URL slug", kind: "string", max: 80 },
  title: { label: "SEO title", kind: "string", max: 120 },
  metaDescription: { label: "Meta description", kind: "string", max: 320 },
  canonical: { label: "Canonical URL", kind: "string", max: 500 },
  robotsIndex: { label: "Robots: index", kind: "bool" },
  robotsFollow: { label: "Robots: follow", kind: "bool" },
  ogTitle: { label: "Open Graph title", kind: "string", max: 120 },
  ogDescription: { label: "Open Graph description", kind: "string", max: 320 },
  ogImage: { label: "Open Graph image URL", kind: "string", max: 500 },
  twitterTitle: { label: "X/Twitter title", kind: "string", max: 120 },
  twitterDescription: { label: "X/Twitter description", kind: "string", max: 320 },
  twitterImage: { label: "X/Twitter image URL", kind: "string", max: 500 },
  twitterCard: { label: "X/Twitter card type", kind: "string", max: 40 },
  h1: { label: "H1 heading", kind: "string", max: 120 },
  intro: { label: "Intro text", kind: "string", max: 10000 },
  body: { label: "SEO text below tool (Markdown)", kind: "string", max: 50000 },
  faq: { label: "FAQ", kind: "json" },
  internalLinks: { label: "Internal links", kind: "json" },
  structuredData: { label: "Structured data", kind: "bool" },
} as const;

export type SeoField = keyof typeof SEO_FIELDS;
export type SeoValue = string | boolean | null | Prisma.JsonValue;
export interface SeoChange {
  toolId: string;
  field: SeoField;
  value: SeoValue;
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateValue(field: SeoField, value: SeoValue): SeoValue {
  const spec = SEO_FIELDS[field];
  if (value === null || value === "") return null;
  if (spec.kind === "bool") {
    if (typeof value !== "boolean") throw new UserError(`${spec.label} must be true or false.`);
    return value;
  }
  if (spec.kind === "string") {
    if (typeof value !== "string") throw new UserError(`${spec.label} must be text.`);
    const v = value.trim();
    if (v.length > spec.max) throw new UserError(`${spec.label} is too long (max ${spec.max} characters).`);
    if (field === "slug" && !SLUG_RE.test(v)) throw new UserError("Slugs may contain lowercase letters, digits and single hyphens only.");
    if ((field === "canonical" || field === "ogImage" || field === "twitterImage") && !/^https:\/\/[^\s]+$/i.test(v)) throw new UserError(`${spec.label} must be an absolute https:// URL.`);
    if (field === "twitterCard" && v !== "summary" && v !== "summary_large_image") throw new UserError("Card type must be summary or summary_large_image.");
    return v || null;
  }
  // JSON fields
  if (field === "faq") {
    if (!Array.isArray(value)) throw new UserError("FAQ must be a list.");
    const items = value
      .map((x) => x as { q?: unknown; a?: unknown })
      .filter((x) => typeof x?.q === "string" && typeof x?.a === "string" && (x.q as string).trim() && (x.a as string).trim())
      .map((x) => ({ q: String(x.q).trim().slice(0, 300), a: String(x.a).trim().slice(0, 2000) }));
    if (items.length > 20) throw new UserError("At most 20 FAQ entries.");
    return items.length ? items : null;
  }
  if (field === "internalLinks") {
    if (!Array.isArray(value)) throw new UserError("Internal links must be a list.");
    const links = value
      .map((x) => x as { label?: unknown; href?: unknown })
      .filter((x) => typeof x?.label === "string" && typeof x?.href === "string" && (x.label as string).trim())
      .map((x) => ({ label: String(x.label).trim().slice(0, 80), href: String(x.href).trim() }));
    for (const l of links) if (!l.href.startsWith("/") || l.href.startsWith("//")) throw new UserError(`Internal link “${l.label}” must be a site path starting with /.`);
    if (links.length > 20) throw new UserError("At most 20 internal links.");
    return links.length ? links : null;
  }
  return value;
}

const jsonEq = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const toJson = (v: SeoValue): Prisma.InputJsonValue | typeof Prisma.JsonNull => (v === null ? Prisma.JsonNull : (v as Prisma.InputJsonValue));

/**
 * Applies SEO changes atomically, recording one SeoRevision per changed field.
 * Slug changes are checked for uniqueness and create a 301 redirect automatically.
 * Returns public paths that need cache invalidation.
 */
export async function applySeoChanges(userId: string | null, changes: SeoChange[], note?: string): Promise<{ batchId: string; changed: number; paths: string[] }> {
  const batchId = randomUUID();
  const paths = new Set<string>();
  let changed = 0;
  const clean = changes.map((c) => {
    if (!TOOL_BY_ID.has(c.toolId)) throw new UserError(`Unknown tool: ${c.toolId}`);
    if (!(c.field in SEO_FIELDS)) throw new UserError(`Unknown field: ${c.field}`);
    return { ...c, value: validateValue(c.field, c.value) };
  });

  await prisma.$transaction(async (tx) => {
    const ids = [...new Set(clean.map((c) => c.toolId))];
    const rows = await tx.toolSeo.findMany({ where: { toolId: { in: ids } } });
    const current = new Map(rows.map((r) => [r.toolId, r]));
    const allSlugs = await tx.toolSeo.findMany({ where: { slug: { not: null } }, select: { toolId: true, slug: true } });
    const effectiveSlug = new Map(TOOL_DEFINITIONS.map((d) => [d.id, d.id]));
    for (const s of allSlugs) effectiveSlug.set(s.toolId, s.slug!);

    for (const c of clean) {
      const row = current.get(c.toolId);
      const oldValue = (row ? (row as Record<string, unknown>)[c.field] : null) ?? null;
      if (jsonEq(oldValue, c.value)) continue;

      if (c.field === "slug") {
        const newSlug = (c.value as string | null) ?? c.toolId;
        const oldSlug = effectiveSlug.get(c.toolId) ?? c.toolId;
        for (const [otherId, otherSlug] of effectiveSlug) {
          if (otherId !== c.toolId && (otherSlug === newSlug || otherId === newSlug)) throw new UserError(`The slug “${newSlug}” is already used by another tool.`);
        }
        effectiveSlug.set(c.toolId, newSlug);
        if (oldSlug !== newSlug) {
          // Old URL → new URL. Remove any rule that would now loop.
          await tx.redirect.deleteMany({ where: { fromPath: `/tools/${newSlug}` } });
          await tx.redirect.upsert({
            where: { fromPath: `/tools/${oldSlug}` },
            create: { fromPath: `/tools/${oldSlug}`, toPath: `/tools/${newSlug}`, statusCode: 301, note: "Automatic: tool slug changed" },
            update: { toPath: `/tools/${newSlug}`, enabled: true, statusCode: 301 },
          });
          await tx.redirect.updateMany({ where: { toPath: `/tools/${oldSlug}` }, data: { toPath: `/tools/${newSlug}` } });
          paths.add(`/tools/${oldSlug}`);
        }
        paths.add(`/tools/${newSlug}`);
      }

      const data: Record<string, unknown> = { [c.field]: SEO_FIELDS[c.field].kind === "json" ? toJson(c.value) : c.value };
      const created = await tx.toolSeo.upsert({ where: { toolId: c.toolId }, create: { toolId: c.toolId, ...data }, update: data });
      current.set(c.toolId, created);
      await tx.seoRevision.create({
        data: { toolId: c.toolId, field: c.field, oldValue: toJson(oldValue as SeoValue), newValue: toJson(c.value), batchId, note: note?.slice(0, 200), userId },
      });
      paths.add(`/tools/${effectiveSlug.get(c.toolId) ?? c.toolId}`);
      changed++;
    }
  });
  return { batchId, changed, paths: [...paths] };
}

/** Restores the value a field had before the given revision (recorded as a new revision). */
export async function revertRevision(userId: string, revisionId: string) {
  const rev = await prisma.seoRevision.findUnique({ where: { id: revisionId } });
  if (!rev) throw new UserError("Revision not found.");
  return applySeoChanges(userId, [{ toolId: rev.toolId, field: rev.field as SeoField, value: rev.oldValue as SeoValue }], `Revert of ${revisionId.slice(0, 8)}`);
}

export async function revertBatch(userId: string, batchId: string) {
  const revs = await prisma.seoRevision.findMany({ where: { batchId }, orderBy: { createdAt: "asc" } });
  if (!revs.length) throw new UserError("Batch not found.");
  return applySeoChanges(userId, revs.map((r) => ({ toolId: r.toolId, field: r.field as SeoField, value: r.oldValue as SeoValue })), `Revert of batch ${batchId.slice(0, 8)}`);
}

/** Simple SEO health checks for the dashboard and SEO manager. */
export function seoIssues(t: { seo: { title: string; metaDescription: string; robotsIndex: boolean; h1: string; faq: unknown[] } }): string[] {
  const issues: string[] = [];
  if (t.seo.title.length > 65) issues.push(`Title is ${t.seo.title.length} chars (>65)`);
  if (t.seo.title.length < 20) issues.push("Title is very short");
  if (t.seo.metaDescription.length > 165) issues.push(`Description is ${t.seo.metaDescription.length} chars (>165)`);
  if (t.seo.metaDescription.length < 70) issues.push("Description is short (<70)");
  if (!t.seo.robotsIndex) issues.push("Set to noindex");
  if (!t.seo.faq.length) issues.push("No FAQ");
  return issues;
}
