import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Cpu, Globe, ShieldCheck } from "lucide-react";
import { categoryOf, getCatalog, getSettings, getToolBySlug } from "@/lib/data";
import { renderMarkdown, paragraphs } from "@/lib/markdown";
import { jsonLdString, toolJsonLd, toolMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ToolCard } from "@/components/site/ToolCard";
import { FavoriteButton, ToolVisit } from "@/components/site/LocalTools";
import { ToolIcon } from "@/components/icons";
import { AdSlot } from "@/components/ads/AdSlot";
import { ToolRenderer } from "@/tools/ToolRenderer";

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  // Rendered on first request and cached (ISR) so builds don't need the database.
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);
  if (!tool) return { title: "Tool not found", robots: { index: false } };
  return toolMetadata(tool, await getSettings());
}

const PROCESSING = {
  browser: { icon: ShieldCheck, label: "Runs in your browser", tone: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50", hint: "Your files and data never leave your device." },
  server: { icon: Cpu, label: "Uses a lightweight server request", tone: "text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-950/50", hint: "Only the minimum needed is sent; nothing is stored." },
  network: { icon: Globe, label: "Needs network access", tone: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/50", hint: "This test contacts network endpoints to measure your connection." },
} as const;

export default async function ToolPage({ params }: Props) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const tool = catalog.tools.find((t) => t.slug === slug && t.enabled);
  if (!tool) {
    // Old default URL after an admin changed the slug → permanent redirect.
    const renamed = catalog.tools.find((t) => t.id === slug && t.enabled && t.slug !== slug);
    if (renamed) permanentRedirect(`/tools/${renamed.slug}`);
    notFound();
  }
  const settings = await getSettings();
  const category = categoryOf(catalog, tool.category);
  const related = tool.related.map((id) => catalog.tools.find((t) => t.id === id && t.enabled)).filter(Boolean) as typeof catalog.tools;
  const p = PROCESSING[tool.processing];
  const PIcon = p.icon;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <ToolVisit id={tool.id} />
      {tool.seo.structuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(toolJsonLd(tool, category, settings)) }} />}
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: category.name, href: `/category/${category.slug}` }, { name: tool.name }]} />

      <div className="mt-5 grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <header className="flex flex-wrap items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-400 text-white shadow-md shadow-brand-600/20">
              <ToolIcon name={tool.icon} className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{tool.seo.h1}</h1>
              <p className="text-muted mt-1.5 max-w-3xl">{tool.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${p.tone}`} title={p.hint}>
                  <PIcon className="h-3.5 w-3.5" aria-hidden /> {p.label}
                </span>
                <FavoriteButton id={tool.id} />
              </div>
            </div>
          </header>

          <AdSlot position="belowTitle" className="mt-6" />

          <section aria-label={`${tool.name} tool`} className="surface mt-6 rounded-3xl p-4 shadow-sm sm:p-6">
            <ToolRenderer toolId={tool.id} implCategory={tool.implCategory} />
          </section>

          <AdSlot position="belowTool" className="mt-10" />

          <article className="prose-content mt-10 max-w-3xl">
            <h2>About the {tool.name}</h2>
            {paragraphs(tool.seo.intro).map((para, i) => (
              <p key={i}>{para}</p>
            ))}

            {tool.steps.length > 0 && (
              <>
                <h2>How to use it</h2>
                <ol>
                  {tool.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </>
            )}

            {tool.seo.body && <div dangerouslySetInnerHTML={{ __html: renderMarkdown(tool.seo.body) }} />}

            {tool.notes.length > 0 && (
              <>
                <h2>Good to know</h2>
                <ul>
                  {tool.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </>
            )}
          </article>

          <AdSlot position="inContent" className="mt-10" />

          {tool.seo.faq.length > 0 && (
            <section className="mt-10 max-w-3xl" aria-labelledby="faq">
              <h2 id="faq" className="mb-4 text-xl font-bold">Frequently asked questions</h2>
              <div className="space-y-2">
                {tool.seo.faq.map((f, i) => (
                  <details key={i} className="surface group rounded-xl px-4 py-3" open={i === 0}>
                    <summary className="cursor-pointer list-none font-semibold marker:hidden">
                      <span className="flex items-center justify-between gap-3">{f.q}<span className="text-muted transition-transform group-open:rotate-45" aria-hidden>+</span></span>
                    </summary>
                    <p className="text-muted mt-2 text-sm leading-relaxed">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {tool.seo.internalLinks.length > 0 && (
            <nav className="mt-10 max-w-3xl" aria-label="Further reading">
              <h2 className="mb-3 text-lg font-bold">See also</h2>
              <ul className="flex flex-wrap gap-2">
                {tool.seo.internalLinks.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="chip hover:!text-brand-600">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {related.length > 0 && (
            <section className="mt-12" aria-labelledby="related">
              <h2 id="related" className="mb-4 text-xl font-bold">Related tools</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {related.map((t) => (
                  <ToolCard key={t.id} compact tool={{ id: t.id, slug: t.slug, name: t.name, description: t.description, icon: t.icon }} />
                ))}
              </div>
              <p className="mt-4 text-sm">
                <Link href={`/category/${category.slug}`} className="font-semibold text-brand-600 hover:underline dark:text-brand-300">More {category.name.toLowerCase()} →</Link>
              </p>
            </section>
          )}
        </div>

        <aside className="hidden xl:block" aria-label="Sidebar">
          <div className="sticky top-24 space-y-6">
            <AdSlot position="sidebar" />
          </div>
        </aside>
      </div>
    </div>
  );
}
