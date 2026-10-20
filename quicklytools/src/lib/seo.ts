import "server-only";
import type { Metadata } from "next";
import type { AllSettings } from "./settings-schema";
import type { ResolvedCategory, ResolvedTool } from "./data";
import { SITE_URL, absoluteUrl } from "./env";

export function toolUrl(t: ResolvedTool) {
  return `/tools/${t.slug}`;
}

export function categoryUrl(c: ResolvedCategory) {
  return `/category/${c.slug}`;
}

export function toolMetadata(t: ResolvedTool, settings: AllSettings): Metadata {
  const url = toolUrl(t);
  const canonical = t.seo.canonical || absoluteUrl(url);
  const ogImage = t.seo.ogImage || settings.site.defaultOgImage || absoluteUrl(`${url}/opengraph-image`);
  const twImage = t.seo.twitterImage || ogImage;
  return {
    title: { absolute: t.seo.title },
    description: t.seo.metaDescription,
    keywords: t.keywords,
    alternates: { canonical },
    robots: { index: t.seo.robotsIndex, follow: t.seo.robotsFollow },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: settings.site.name,
      title: t.seo.ogTitle,
      description: t.seo.ogDescription,
      images: [{ url: ogImage, width: 1200, height: 630, alt: t.seo.ogTitle }],
      locale: "en_US",
    },
    twitter: {
      card: t.seo.twitterCard,
      title: t.seo.twitterTitle,
      description: t.seo.twitterDescription,
      images: [twImage],
      site: settings.site.twitterHandle || undefined,
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}

/**
 * WebApplication markup describes the free tool truthfully (no fake ratings).
 * FAQPage is emitted only because the same Q&A is visible on the page.
 */
export function toolJsonLd(t: ResolvedTool, category: ResolvedCategory, settings: AllSettings) {
  const url = t.seo.canonical || absoluteUrl(toolUrl(t));
  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebApplication",
      "@id": `${url}#app`,
      name: t.name,
      url,
      description: t.seo.metaDescription,
      applicationCategory: category.id === "developer" ? "DeveloperApplication" : category.id === "calculators" ? "FinanceApplication" : "UtilitiesApplication",
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires JavaScript and a modern web browser",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@type": "Organization", name: settings.site.organizationName || settings.site.name, url: SITE_URL },
    },
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: category.name, path: categoryUrl(category) },
      { name: t.name, path: toolUrl(t) },
    ]),
  ];
  if (t.steps.length >= 2) {
    graph.push({
      "@type": "HowTo",
      name: `How to use ${t.name}`,
      step: t.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })),
    });
  }
  if (t.seo.faq.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: t.seo.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph.map((g) => { const { "@context": _c, ...rest } = g as Record<string, unknown>; void _c; return rest; }) };
}

export function websiteJsonLd(settings: AllSettings) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: settings.site.name,
        description: settings.site.tagline,
        potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/tools?q={search_term_string}` }, "query-input": "required name=search_term_string" },
      },
      { "@type": "Organization", "@id": `${SITE_URL}/#org`, name: settings.site.organizationName || settings.site.name, url: SITE_URL, logo: absoluteUrl("/icon.svg") },
    ],
  };
}

/** Serializes JSON-LD safely for embedding in a <script> tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
