"use client";

import { useState } from "react";
import type { FooterSettings, HomeSettings, NavSettings, SiteSettings } from "@/lib/settings-schema";
import { AdminForm, Card, SubmitButton } from "@/components/admin/Form";
import { saveSettingAction } from "../../actions";

type Link = { label: string; href: string };

function LinksEditor({ links, onChange, max = 12 }: { links: Link[]; onChange: (l: Link[]) => void; max?: number }) {
  return (
    <div className="space-y-2">
      {links.map((l, i) => (
        <div key={i} className="flex gap-2">
          <input className="field" placeholder="Label" value={l.label} onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <input className="field font-mono" placeholder="/path or https://…" value={l.href} onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)))} />
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Move up" disabled={i === 0} onClick={() => { const a = [...links]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a); }}>↑</button>
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Remove" onClick={() => onChange(links.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" disabled={links.length >= max} onClick={() => onChange([...links, { label: "", href: "/" }])}>Add link</button>
    </div>
  );
}

function SettingForm({ settingKey, value, title, description, children }: { settingKey: string; value: unknown; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card title={title} description={description}>
      <AdminForm action={saveSettingAction}>
        {(state) => (
          <>
            <input type="hidden" name="key" value={settingKey} />
            <input type="hidden" name="value" value={JSON.stringify(value)} />
            {children}
            {state.fieldErrors && <ul className="mt-2 text-xs text-red-600">{Object.entries(state.fieldErrors).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>}
            <div className="mt-4"><SubmitButton>Save</SubmitButton></div>
          </>
        )}
      </AdminForm>
    </Card>
  );
}

const F = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="block"><span className="label">{label}</span>{children}{hint && <span className="text-muted mt-1 block text-xs">{hint}</span>}</label>
);

export function SiteForm({ value }: { value: SiteSettings }) {
  const [v, setV] = useState(value);
  const set = (k: keyof SiteSettings) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <SettingForm settingKey="site" value={v} title="Site settings">
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Site name"><input className="field" value={v.name} onChange={set("name")} /></F>
        <F label="Organization name (structured data)"><input className="field" value={v.organizationName} onChange={set("organizationName")} /></F>
        <F label="Tagline / default description"><input className="field" value={v.tagline} onChange={set("tagline")} /></F>
        <F label="Contact email"><input className="field" value={v.contactEmail} onChange={set("contactEmail")} /></F>
        <F label="X/Twitter handle" hint="e.g. @yourbrand"><input className="field" value={v.twitterHandle} onChange={set("twitterHandle")} /></F>
        <F label="Default Open Graph image (https URL)"><input className="field" value={v.defaultOgImage} onChange={set("defaultOgImage")} /></F>
        <F label="Google Search Console verification code"><input className="field" value={v.googleSiteVerification} onChange={set("googleSiteVerification")} /></F>
        <F label="Bing verification code"><input className="field" value={v.bingSiteVerification} onChange={set("bingSiteVerification")} /></F>
      </div>
    </SettingForm>
  );
}

export function HomeForm({ value, tools }: { value: HomeSettings; tools: { id: string; name: string }[] }) {
  const [v, setV] = useState(value);
  const [pick, setPick] = useState("");
  return (
    <SettingForm settingKey="home" value={v} title="Homepage">
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Hero title"><input className="field" value={v.heroTitle} onChange={(e) => setV({ ...v, heroTitle: e.target.value })} /></F>
        <F label="SEO title (empty = automatic)"><input className="field" value={v.seoTitle} onChange={(e) => setV({ ...v, seoTitle: e.target.value })} /></F>
        <F label="Hero subtitle"><textarea className="field !font-sans !text-sm" rows={2} value={v.heroSubtitle} onChange={(e) => setV({ ...v, heroSubtitle: e.target.value })} /></F>
        <F label="Meta description (empty = tagline)"><textarea className="field !font-sans !text-sm" rows={2} value={v.metaDescription} onChange={(e) => setV({ ...v, metaDescription: e.target.value })} /></F>
      </div>
      <div className="mt-4">
        <span className="label">Featured tools (empty = tools marked popular)</span>
        <div className="flex flex-wrap gap-2">
          {v.featuredToolIds.map((id) => <span key={id} className="chip">{tools.find((t) => t.id === id)?.name ?? id} <button type="button" onClick={() => setV({ ...v, featuredToolIds: v.featuredToolIds.filter((x) => x !== id) })}>×</button></span>)}
        </div>
        <div className="mt-2 flex gap-2">
          <select className="field max-w-sm" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Add tool…</option>{tools.filter((t) => !v.featuredToolIds.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <button type="button" className="btn btn-secondary" disabled={!pick || v.featuredToolIds.length >= 24} onClick={() => (setV({ ...v, featuredToolIds: [...v.featuredToolIds, pick] }), setPick(""))}>Add</button>
        </div>
      </div>
      <div className="mt-4"><F label="Intro section (Markdown)"><textarea className="field" rows={8} value={v.introMarkdown} onChange={(e) => setV({ ...v, introMarkdown: e.target.value })} /></F></div>
    </SettingForm>
  );
}

export function NavForm({ value }: { value: NavSettings }) {
  const [v, setV] = useState(value);
  return (
    <SettingForm settingKey="nav" value={v} title="Main navigation">
      <LinksEditor links={v.links} onChange={(links) => setV({ links })} />
    </SettingForm>
  );
}

export function FooterForm({ value }: { value: FooterSettings }) {
  const [v, setV] = useState(value);
  return (
    <SettingForm settingKey="footer" value={v} title="Footer">
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="About text"><textarea className="field !font-sans !text-sm" rows={3} value={v.about} onChange={(e) => setV({ ...v, about: e.target.value })} /></F>
        <F label="Copyright" hint="{year} and {siteName} are replaced automatically"><input className="field" value={v.copyright} onChange={(e) => setV({ ...v, copyright: e.target.value })} /></F>
      </div>
      <div className="mt-4 space-y-4">
        {v.columns.map((col, i) => (
          <div key={i} className="border-base rounded-xl border p-3">
            <div className="mb-2 flex gap-2">
              <input className="field max-w-xs" value={col.title} onChange={(e) => setV({ ...v, columns: v.columns.map((c, j) => (j === i ? { ...c, title: e.target.value } : c)) })} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setV({ ...v, columns: v.columns.filter((_, j) => j !== i) })}>Remove column</button>
            </div>
            <LinksEditor links={col.links} onChange={(links) => setV({ ...v, columns: v.columns.map((c, j) => (j === i ? { ...c, links } : c)) })} />
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" disabled={v.columns.length >= 5} onClick={() => setV({ ...v, columns: [...v.columns, { title: "New column", links: [] }] })}>Add column</button>
      </div>
    </SettingForm>
  );
}
