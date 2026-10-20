import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage, getSettings, STATIC_PAGE_SLUGS } from "@/lib/data";
import { renderMarkdown } from "@/lib/markdown";
import { absoluteUrl } from "@/lib/env";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { PageViewTracker } from "@/components/site/LocalTools";

export const revalidate = 3600;
// Unknown slugs 404 via notFound(). Keep dynamicParams on: with `false`, the
// startup/admin cache refresh makes Next.js answer these pages with NoFallbackError (404).
export const dynamicParams = true;

export function generateStaticParams() {
  return STATIC_PAGE_SLUGS.map((page) => ({ page }));
}

type Props = { params: Promise<{ page: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page } = await params;
  const [p, s] = await Promise.all([getPage(page), getSettings()]);
  if (!p) return { title: "Not found", robots: { index: false } };
  return { title: { absolute: `${p.title} | ${s.site.name}` }, description: p.metaDescription, alternates: { canonical: absoluteUrl(`/${page}`) } };
}

export default async function StaticPage({ params }: Props) {
  const { page } = await params;
  const p = await getPage(page);
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageViewTracker path={`/${page}`} />
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: p.title }]} />
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{p.title}</h1>
      <article className="prose-content mt-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.body) }} />
    </div>
  );
}
