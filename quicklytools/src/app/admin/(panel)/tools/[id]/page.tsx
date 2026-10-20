import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/data";
import { can, requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDefinition, TOOL_DEFINITIONS } from "@/tools/registry";
import { ICON_KEYS } from "@/components/icons";
import { seoIssues } from "@/lib/seo-service";
import { ToolGeneralForm } from "./ToolGeneralForm";
import { ToolSeoForm } from "./ToolSeoForm";
import { SITE_URL } from "@/lib/env";

export const metadata = { title: "Edit tool" };

export default async function EditTool({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser("editSeo");
  const { id } = await params;
  const def = getDefinition(id);
  if (!def) notFound();
  const catalog = await getCatalog();
  const tool = catalog.tools.find((t) => t.id === id)!;
  const [override, seoRow, revisions] = await Promise.all([
    prisma.toolOverride.findUnique({ where: { toolId: id } }),
    prisma.toolSeo.findUnique({ where: { toolId: id } }),
    prisma.seoRevision.findMany({ where: { toolId: id }, orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { email: true } } } }),
  ]);
  const issues = seoIssues(tool);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/tools" className="text-muted text-sm hover:underline">← Tools</Link>
          <h1 className="text-2xl font-bold">{tool.name}</h1>
          <p className="text-muted font-mono text-xs">id: {id} · implementation: {def.category}</p>
        </div>
        <a href={`/tools/${tool.slug}`} target="_blank" className="btn btn-secondary btn-sm">View live page ↗</a>
      </div>
      {issues.length > 0 && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">SEO checks: {issues.join(" · ")}</p>}
      {can(user.role, "manageTools") && (
        <ToolGeneralForm
          tool={{ id, enabled: tool.enabled, popular: tool.popular, searchVisible: tool.searchVisible, order: override?.sortOrder ?? null, defaultOrder: TOOL_DEFINITIONS.findIndex((d) => d.id === id) }}
          override={{ name: override?.name ?? "", description: override?.description ?? "", categoryId: override?.categoryId ?? "", icon: override?.icon ?? "", hasRelated: override?.hasRelated ?? false, relatedIds: override?.hasRelated ? override.relatedIds : def.related }}
          defaults={{ name: def.name, description: def.summary, category: def.category, icon: def.icon, related: def.related }}
          categories={catalog.categories.map((c) => ({ id: c.id, name: c.name }))}
          allTools={catalog.tools.filter((t) => t.id !== id).map((t) => ({ id: t.id, name: t.name }))}
          icons={ICON_KEYS}
        />
      )}
      <div id="seo">
        <ToolSeoForm
          toolId={id}
          siteUrl={SITE_URL}
          current={{
            slug: seoRow?.slug ?? "", title: seoRow?.title ?? "", metaDescription: seoRow?.metaDescription ?? "", canonical: seoRow?.canonical ?? "",
            robotsIndex: seoRow?.robotsIndex ?? null, robotsFollow: seoRow?.robotsFollow ?? null, ogTitle: seoRow?.ogTitle ?? "", ogDescription: seoRow?.ogDescription ?? "", ogImage: seoRow?.ogImage ?? "",
            twitterTitle: seoRow?.twitterTitle ?? "", twitterDescription: seoRow?.twitterDescription ?? "", twitterImage: seoRow?.twitterImage ?? "", twitterCard: seoRow?.twitterCard ?? "",
            h1: seoRow?.h1 ?? "", intro: seoRow?.intro ?? "", body: seoRow?.body ?? "", structuredData: seoRow?.structuredData ?? null,
            faq: (Array.isArray(seoRow?.faq) ? seoRow!.faq : []) as { q: string; a: string }[],
            internalLinks: (Array.isArray(seoRow?.internalLinks) ? seoRow!.internalLinks : []) as { label: string; href: string }[],
          }}
          defaults={{ slug: id, title: tool.seo.title, metaDescription: tool.description, h1: tool.name, intro: def.intro, faq: def.faq }}
        />
      </div>
      <section className="surface rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Recent SEO changes</h2><Link href={`/admin/seo/history?tool=${id}`} className="btn btn-secondary btn-sm">Full history</Link></div>
        {revisions.length ? (
          <ul className="space-y-1 text-sm">
            {revisions.map((r) => <li key={r.id}><span className="text-muted tabular-nums">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span> · <strong>{r.field}</strong> by {r.user?.email ?? "unknown"}</li>)}
          </ul>
        ) : <p className="text-muted text-sm">No changes yet — all values are the defaults from code.</p>}
      </section>
    </div>
  );
}
