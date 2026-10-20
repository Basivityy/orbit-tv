import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Lock, Sparkles, Zap } from "lucide-react";
import { getCatalog, getSettings } from "@/lib/data";
import { renderMarkdown } from "@/lib/markdown";
import { jsonLdString, websiteJsonLd } from "@/lib/seo";
import { absoluteUrl } from "@/lib/env";
import { SearchBox } from "@/components/site/SearchBox";
import { ToolGrid } from "@/components/site/ToolCard";
import { MyTools, PageViewTracker } from "@/components/site/LocalTools";
import { ToolIcon } from "@/components/icons";
import { AdSlot } from "@/components/ads/AdSlot";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const title = s.home.seoTitle || `${s.site.name} – Free Online Tools for Images, PDF, Text & Code`;
  const description = s.home.metaDescription || s.site.tagline;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: absoluteUrl("/") },
    openGraph: { type: "website", url: absoluteUrl("/"), title, description, siteName: s.site.name, images: s.site.defaultOgImage ? [s.site.defaultOgImage] : [absoluteUrl("/opengraph-image")] },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function HomePage() {
  const [s, catalog] = await Promise.all([getSettings(), getCatalog()]);
  const tools = catalog.tools.filter((t) => t.enabled);
  const card = (t: (typeof tools)[number]) => ({ id: t.id, slug: t.slug, name: t.name, description: t.description, icon: t.icon, popular: t.popular });
  const featured = s.home.featuredToolIds.length
    ? (s.home.featuredToolIds.map((id) => tools.find((t) => t.id === id)).filter(Boolean) as typeof tools)
    : tools.filter((t) => t.popular).slice(0, 12);

  return (
    <>
      <PageViewTracker path="/" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(websiteJsonLd(s)) }} />
      <section className="relative overflow-hidden border-b border-[var(--border)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--color-brand-500)_18%,transparent),transparent_60%)]" />
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <p className="chip mx-auto mb-5 !text-brand-700 dark:!text-brand-300"><Lock className="h-3.5 w-3.5" aria-hidden /> Files stay on your device</p>
          <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">{s.home.heroTitle}</h1>
          <p className="text-muted mx-auto mt-5 max-w-2xl text-lg text-balance">{s.home.heroSubtitle}</p>
          <div className="mx-auto mt-8 max-w-xl text-left">
            <SearchBox variant="hero" />
          </div>
          <div className="text-muted mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-500" aria-hidden /> Instant, no uploads</span>
            <span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-brand-500" aria-hidden /> No sign-up</span>
            <span className="flex items-center gap-1.5"><Lock className="h-4 w-4 text-emerald-500" aria-hidden /> Private by design</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12 sm:px-6">
        <MyTools tools={tools.map(card)} />

        <section aria-labelledby="popular">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="popular" className="text-2xl font-bold tracking-tight">Popular tools</h2>
            <Link href="/tools" className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300">All {tools.length} tools →</Link>
          </div>
          <ToolGrid tools={featured.map(card)} />
        </section>

        <AdSlot position="inContent" />

        <section aria-labelledby="cats">
          <h2 id="cats" className="mb-4 text-2xl font-bold tracking-tight">Browse by category</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {catalog.categories.map((c) => {
              const inCat = tools.filter((t) => t.category === c.id);
              if (!inCat.length) return null;
              return (
                <Link key={c.id} href={`/category/${c.slug}`} className="group surface flex flex-col rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg dark:hover:border-brand-700">
                  <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-cyan-400 text-white shadow-md shadow-brand-600/20">
                    <ToolIcon name={c.icon} className="h-5 w-5" />
                  </span>
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-muted mt-1 flex-1 text-sm">{c.description}</span>
                  <span className="mt-3 flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-300">
                    {inCat.length} tools <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {s.home.introMarkdown && <section className="prose-content mx-auto max-w-3xl" dangerouslySetInnerHTML={{ __html: renderMarkdown(s.home.introMarkdown) }} />}
      </div>
    </>
  );
}
