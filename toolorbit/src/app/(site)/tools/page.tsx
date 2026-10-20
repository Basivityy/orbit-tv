import type { Metadata } from "next";
import { getCatalog, getSettings } from "@/lib/data";
import { absoluteUrl } from "@/lib/env";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ToolGrid } from "@/components/site/ToolCard";
import { AllToolsFilter } from "./AllToolsFilter";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const [s, c] = await Promise.all([getSettings(), getCatalog()]);
  const n = c.tools.filter((t) => t.enabled).length;
  return {
    title: `All ${n} Free Online Tools`,
    description: `Browse all ${n} free tools on ${s.site.name}: image converters, PDF editors, text utilities, developer tools, calculators and generators.`,
    alternates: { canonical: absoluteUrl("/tools") },
  };
}

export default async function AllToolsPage() {
  const catalog = await getCatalog();
  const tools = catalog.tools.filter((t) => t.enabled);
  const groups = catalog.categories
    .map((c) => ({ c, tools: tools.filter((t) => t.category === c.id) }))
    .filter((g) => g.tools.length);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "All tools" }]} />
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">All tools</h1>
      <p className="text-muted mt-2 max-w-2xl">{tools.length} free tools. Use the filter to find one quickly, or browse by category below.</p>
      <AllToolsFilter
        tools={tools.filter((t) => t.searchVisible).map((t) => ({ id: t.id, slug: t.slug, name: t.name, description: t.description, icon: t.icon, keywords: t.keywords.join(" ") }))}
      >
        <div className="space-y-12">
          {groups.map(({ c, tools: list }) => (
            <section key={c.id} aria-labelledby={`cat-${c.id}`}>
              <h2 id={`cat-${c.id}`} className="mb-4 text-xl font-bold">
                <a href={`/category/${c.slug}`} className="hover:text-brand-600">{c.name}</a> <span className="text-muted text-sm font-normal">({list.length})</span>
              </h2>
              <ToolGrid compact tools={list.map((t) => ({ id: t.id, slug: t.slug, name: t.name, description: t.description, icon: t.icon }))} />
            </section>
          ))}
        </div>
      </AllToolsFilter>
    </div>
  );
}
