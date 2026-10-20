"use client";

import { useState } from "react";
import { AdminForm, Card, SubmitButton } from "@/components/admin/Form";
import { CountedInput } from "@/components/admin/CharCount";
import { updateSeoAction } from "../../../actions";

interface Seo {
  slug: string; title: string; metaDescription: string; canonical: string; robotsIndex: boolean | null; robotsFollow: boolean | null;
  ogTitle: string; ogDescription: string; ogImage: string; twitterTitle: string; twitterDescription: string; twitterImage: string; twitterCard: string;
  h1: string; intro: string; body: string; structuredData: boolean | null; faq: { q: string; a: string }[]; internalLinks: { label: string; href: string }[];
}

const triState = (v: boolean | null) => (v === null ? "default" : String(v));

export function ToolSeoForm({ toolId, siteUrl, current, defaults }: { toolId: string; siteUrl: string; current: Seo; defaults: { slug: string; title: string; metaDescription: string; h1: string; intro: string; faq: { q: string; a: string }[] } }) {
  const [faq, setFaq] = useState(current.faq);
  const [links, setLinks] = useState(current.internalLinks);
  const [slug, setSlug] = useState(current.slug);
  const [title, setTitle] = useState(current.title);
  const [desc, setDesc] = useState(current.metaDescription);
  const shownTitle = title || defaults.title;
  const shownDesc = desc || defaults.metaDescription;
  return (
    <Card title="SEO" description="Changes update the server-rendered HTML and are recorded in SEO history (revertible). Empty = default.">
      <AdminForm action={updateSeoAction}>
        <input type="hidden" name="toolId" value={toolId} />
        <input type="hidden" name="faq" value={JSON.stringify(faq.filter((f) => f.q.trim() && f.a.trim()))} />
        <input type="hidden" name="internalLinks" value={JSON.stringify(links.filter((l) => l.label.trim() && l.href.trim()))} />

        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-muted mb-1 text-xs font-semibold">Google preview (approximate)</p>
          <p className="truncate text-xs text-slate-600 dark:text-slate-400">{siteUrl}/tools/{slug || defaults.slug}</p>
          <p className="truncate text-lg text-[#1a0dab] dark:text-[#8ab4f8]">{shownTitle}</p>
          <p className="line-clamp-2 text-sm text-slate-700 dark:text-slate-300">{shownDesc}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="label">URL slug</span>
            <input className="field font-mono" name="slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder={defaults.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
            <span className="text-muted mt-1 block text-xs">Changing it creates a 301 redirect from the old URL automatically.</span>
          </label>
          <label className="block"><span className="label">H1 heading</span><input className="field" name="h1" defaultValue={current.h1} placeholder={defaults.h1} maxLength={120} /></label>
          <label className="block sm:col-span-2"><span className="label flex justify-between"><span>SEO title</span><span className="font-mono text-xs">{shownTitle.length} chars · ideal 30–60</span></span><input className="field" name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={defaults.title} maxLength={120} /></label>
          <label className="block sm:col-span-2"><span className="label flex justify-between"><span>Meta description</span><span className="font-mono text-xs">{shownDesc.length} chars · ideal 120–160</span></span><textarea className="field !font-sans !text-sm" name="metaDescription" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={defaults.metaDescription} maxLength={320} /></label>
          <label className="block sm:col-span-2"><span className="label">Canonical URL</span><input className="field" name="canonical" defaultValue={current.canonical} placeholder={`${siteUrl}/tools/${slug || defaults.slug} (self-referencing)`} /><span className="text-muted mt-1 block text-xs">Only set when this page duplicates another URL. Pages with a custom canonical are left out of the sitemap.</span></label>
          <label className="block"><span className="label">Robots: index</span>
            <select className="field" name="robotsIndex" defaultValue={triState(current.robotsIndex)}><option value="default">Default (index)</option><option value="true">index</option><option value="false">noindex</option></select>
          </label>
          <label className="block"><span className="label">Robots: follow</span>
            <select className="field" name="robotsFollow" defaultValue={triState(current.robotsFollow)}><option value="default">Default (follow)</option><option value="true">follow</option><option value="false">nofollow</option></select>
          </label>
        </div>

        <h3 className="mt-6 mb-3 text-sm font-semibold">Social sharing</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <CountedInput label="Open Graph title" name="ogTitle" defaultValue={current.ogTitle} placeholder={shownTitle} min={20} max={70} />
          <label className="block"><span className="label">Open Graph image (https URL, 1200×630)</span><input className="field" name="ogImage" defaultValue={current.ogImage} placeholder="Auto-generated image" /></label>
          <div className="sm:col-span-2"><CountedInput label="Open Graph description" name="ogDescription" defaultValue={current.ogDescription} placeholder={shownDesc} min={60} max={200} multiline /></div>
          <CountedInput label="X/Twitter title" name="twitterTitle" defaultValue={current.twitterTitle} placeholder="Same as Open Graph" min={20} max={70} />
          <label className="block"><span className="label">X/Twitter card</span>
            <select className="field" name="twitterCard" defaultValue={current.twitterCard}><option value="">Default (large image)</option><option value="summary_large_image">summary_large_image</option><option value="summary">summary</option></select>
          </label>
          <div className="sm:col-span-2"><CountedInput label="X/Twitter description" name="twitterDescription" defaultValue={current.twitterDescription} placeholder="Same as Open Graph" min={60} max={200} multiline /></div>
          <label className="block sm:col-span-2"><span className="label">X/Twitter image (https URL)</span><input className="field" name="twitterImage" defaultValue={current.twitterImage} placeholder="Same as Open Graph image" /></label>
        </div>

        <h3 className="mt-6 mb-3 text-sm font-semibold">On-page content</h3>
        <div className="grid gap-4">
          <label className="block"><span className="label">Intro text (plain text, blank line between paragraphs)</span><textarea className="field !font-sans !text-sm" name="intro" rows={5} defaultValue={current.intro} placeholder={defaults.intro} /></label>
          <label className="block"><span className="label">SEO text below the tool (Markdown)</span><textarea className="field" name="body" rows={8} defaultValue={current.body} placeholder="## Heading&#10;&#10;Useful, unique content…" /><span className="text-muted mt-1 block text-xs">Rendered after “How to use it”. Supports headings, lists, links and tables; HTML is sanitised.</span></label>
          <label className="block"><span className="label">Structured data (JSON-LD)</span>
            <select className="field max-w-xs" name="structuredData" defaultValue={triState(current.structuredData)}><option value="default">Default (enabled)</option><option value="true">Enabled</option><option value="false">Disabled</option></select>
          </label>
        </div>

        <h3 className="mt-6 mb-2 text-sm font-semibold">FAQ {faq.length === 0 && <span className="text-muted font-normal">— using {defaults.faq.length} default question(s)</span>}</h3>
        <div className="space-y-3">
          {faq.map((f, i) => (
            <div key={i} className="border-base grid gap-2 rounded-xl border p-3">
              <input className="field" placeholder="Question" value={f.q} onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
              <textarea className="field !font-sans !text-sm" rows={2} placeholder="Answer" value={f.a} onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
              <button type="button" className="btn btn-ghost btn-sm justify-self-end" onClick={() => setFaq(faq.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFaq([...faq, { q: "", a: "" }])}>Add question</button>
            {faq.length === 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFaq(defaults.faq)}>Copy defaults to edit</button>}
            {faq.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFaq([])}>Use defaults</button>}
          </div>
        </div>

        <h3 className="mt-6 mb-2 text-sm font-semibold">Internal links (“See also”)</h3>
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input className="field" placeholder="Label" value={l.label} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input className="field font-mono" placeholder="/tools/merge-pdf" value={l.href} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)))} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLinks(links.filter((_, j) => j !== i))} aria-label="Remove link">×</button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLinks([...links, { label: "", href: "" }])}>Add link</button>
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="block min-w-64 flex-1"><span className="label">Change note (optional, shown in history)</span><input className="field" name="note" maxLength={200} /></label>
          <SubmitButton>Save & publish SEO</SubmitButton>
        </div>
      </AdminForm>
    </Card>
  );
}

