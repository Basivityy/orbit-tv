import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalog, getCategoryBySlug, getSettings } from "@/lib/data";
import { absoluteUrl } from "@/lib/env";
import { breadcrumbJsonLd, jsonLdString } from "@/lib/seo";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ToolGrid } from "@/components/site/ToolCard";
import { PageViewTracker } from "@/components/site/LocalTools";
import { AdSlot } from "@/components/ads/AdSlot";
import { CATEGORIES } from "@/tools/categories";

export const revalidate = 3600;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [c, s] = await Promise.all([getCategoryBySlug(slug), getSettings()]);
  if (!c) return { title: "Category not found", robots: { index: false } };
  const url = absoluteUrl(`/category/${c.slug}`);
  return {
    title: { absolute: `${c.seoTitle} | ${s.site.name}` },
    description: c.metaDescription,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title: c.seoTitle, description: c.metaDescription, siteName: s.site.name },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const c = catalog.categories.find((x) => x.slug === slug);
  if (!c) notFound();
  const tools = catalog.tools.filter((t) => t.enabled && t.category === c.id);
  const popular = tools.filter((t) => t.popular);
  const card = (t: (typeof tools)[number]) => ({ id: t.id, slug: t.slug, name: t.name, description: t.description, icon: t.icon });
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: c.name,
    itemListElement: tools.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(`/tools/${t.slug}`), name: t.name })),
  };
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageViewTracker path={`/category/${c.slug}`} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(itemList) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: c.name, path: `/category/${c.slug}` }])) }} />
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: c.name }]} />
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{c.name}</h1>
      <p className="text-muted mt-3 max-w-3xl text-lg">{c.intro}</p>
      {popular.length > 0 && (
        <section className="mt-10" aria-labelledby="pop">
          <h2 id="pop" className="mb-4 text-xl font-bold">Most popular</h2>
          <ToolGrid tools={popular.map(card)} />
        </section>
      )}
      <AdSlot position="inContent" className="mt-10" />
      <section className="mt-10" aria-labelledby="all">
        <h2 id="all" className="mb-4 text-xl font-bold">All {c.name.toLowerCase()} ({tools.length})</h2>
        <ToolGrid tools={tools.map(card)} />
      </section>
    </div>
  );
}
