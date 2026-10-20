import { describe, expect, it } from "vitest";
import { TOOL_DEFINITIONS } from "@/tools/registry";
import { CATEGORIES } from "@/tools/categories";
import { ICONS } from "@/components/icons";
import { buildCatalog } from "@/lib/data-catalog";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe("tool registry & content quality", () => {
  it("has 180 unique tools with valid categories, icons and related links", () => {
    expect(TOOL_DEFINITIONS.length).toBeGreaterThanOrEqual(180);
    const ids = TOOL_DEFINITIONS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TOOL_DEFINITIONS) {
      expect(t.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(CATEGORIES.some((c) => c.id === t.category)).toBe(true);
      expect(ICONS[t.icon], `${t.id} icon ${t.icon}`).toBeDefined();
      for (const r of t.related) expect(ids, `${t.id} → ${r}`).toContain(r);
      expect(t.related).not.toContain(t.id);
    }
  });
  it("every tool has unique, substantial SEO content", () => {
    const summaries = new Set<string>();
    const intros = new Set<string>();
    for (const t of TOOL_DEFINITIONS) {
      expect(t.summary.length, t.id).toBeLessThanOrEqual(170);
      expect(t.summary.length, t.id).toBeGreaterThan(60);
      expect(words(t.intro), `${t.id} intro`).toBeGreaterThanOrEqual(35);
      expect(t.steps.length, t.id).toBeGreaterThanOrEqual(1);
      expect(t.notes.length, t.id).toBeGreaterThanOrEqual(1);
      expect(t.faq.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.keywords.length, t.id).toBeGreaterThanOrEqual(3);
      summaries.add(t.summary);
      intros.add(t.intro);
    }
    expect(summaries.size).toBe(TOOL_DEFINITIONS.length);
    expect(intros.size).toBe(TOOL_DEFINITIONS.length);
  });
  it("every tool has a UI implementation in its category module", async () => {
    const mods = {
      image: (await import("@/tools/impl/image")).default,
      pdf: (await import("@/tools/impl/pdf")).default,
      text: (await import("@/tools/impl/text")).default,
      developer: (await import("@/tools/impl/developer")).default,
      calculators: (await import("@/tools/impl/calculators")).default,
      generators: (await import("@/tools/impl/generators")).default,
      browser: (await import("@/tools/impl/browser")).default,
      utilities: (await import("@/tools/impl/utilities")).default,
    };
    for (const t of TOOL_DEFINITIONS) expect(typeof mods[t.category][t.id], `${t.category}/${t.id}`).toBe("function");
    const implCount = Object.values(mods).reduce((s, m) => s + Object.keys(m).length, 0);
    expect(implCount).toBe(TOOL_DEFINITIONS.length);
  });
});

describe("catalog overrides", () => {
  it("applies admin overrides over code defaults", () => {
    const now = new Date();
    const cat = buildCatalog(
      [{ toolId: "word-counter", name: "Words!", categoryId: "utilities", description: null, icon: null, enabled: false, popular: true, sortOrder: -5, searchVisible: null, relatedIds: ["merge-pdf"], hasRelated: true, updatedAt: now }],
      [{ toolId: "word-counter", slug: "count-words", title: "Custom title", metaDescription: null, canonical: null, robotsIndex: false, robotsFollow: null, ogTitle: null, ogDescription: null, ogImage: null, twitterTitle: null, twitterDescription: null, twitterImage: null, twitterCard: "summary", h1: null, intro: null, body: "## Extra", faq: [{ q: "Q?", a: "A." }], internalLinks: [{ label: "PDF", href: "/tools/merge-pdf" }], structuredData: null, updatedAt: now }],
      [{ categoryId: "text", name: "Writing", description: null, intro: null, seoTitle: null, metaDescription: null, sortOrder: 99, updatedAt: now }],
      "TestSite",
    );
    const t = cat.tools.find((x) => x.id === "word-counter")!;
    expect(t).toMatchObject({ name: "Words!", category: "utilities", implCategory: "text", enabled: false, popular: true, slug: "count-words", related: ["merge-pdf"] });
    expect(t.seo).toMatchObject({ title: "Custom title", robotsIndex: false, twitterCard: "summary", body: "## Extra", h1: "Words!", faq: [{ q: "Q?", a: "A." }] });
    expect(cat.tools[0].id).toBe("word-counter");
    expect(cat.categories.find((c) => c.id === "text")!.name).toBe("Writing");
    expect(cat.categories[cat.categories.length - 1].id).toBe("text");
    const def = cat.tools.find((x) => x.id === "merge-pdf")!;
    expect(def.seo.title).toBe("Merge PDF – Free Online Tool | TestSite");
    expect(def.slug).toBe("merge-pdf");
  });
});
