"use client";

import { useState } from "react";
import { ActionButton, AdminForm, Card, SubmitButton, Toggle } from "@/components/admin/Form";
import { ToolIcon } from "@/components/icons";
import { updateToolAction, resetToolAction } from "../../../actions";

interface Props {
  tool: { id: string; enabled: boolean; popular: boolean; searchVisible: boolean; order: number | null; defaultOrder: number };
  override: { name: string; description: string; categoryId: string; icon: string; hasRelated: boolean; relatedIds: string[] };
  defaults: { name: string; description: string; category: string; icon: string; related: string[] };
  categories: { id: string; name: string }[];
  allTools: { id: string; name: string }[];
  icons: string[];
}

export function ToolGeneralForm({ tool, override, defaults, categories, allTools, icons }: Props) {
  const [icon, setIcon] = useState(override.icon);
  const [custom, setCustom] = useState(override.hasRelated);
  const [related, setRelated] = useState<string[]>(override.relatedIds);
  const [pick, setPick] = useState("");
  const name = (id: string) => allTools.find((t) => t.id === id)?.name ?? id;
  return (
    <Card title="General" description="Leave a field empty to use the default from code (shown as placeholder)." actions={<ActionButton action={resetToolAction} fields={{ toolId: tool.id }} label="Reset to defaults" confirm="Reset all general settings of this tool?" />}>
      <AdminForm action={updateToolAction}>
        <input type="hidden" name="toolId" value={tool.id} />
        <input type="hidden" name="relatedIds" value={JSON.stringify(related)} />
        <input type="hidden" name="icon" value={icon} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="label">Display name</span><input className="field" name="name" defaultValue={override.name} placeholder={defaults.name} maxLength={80} /></label>
          <label className="block"><span className="label">Category</span>
            <select className="field" name="categoryId" defaultValue={override.categoryId}>
              <option value="">Default ({categories.find((c) => c.id === defaults.category)?.name})</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block sm:col-span-2"><span className="label">Short description (also default meta description)</span><textarea className="field !font-sans !text-sm" name="description" rows={2} defaultValue={override.description} placeholder={defaults.description} maxLength={300} /></label>
          <label className="block"><span className="label">Sort order (lower = earlier)</span><input className="field" type="number" name="sortOrder" defaultValue={tool.order ?? ""} placeholder={String(tool.defaultOrder)} /></label>
          <div>
            <span className="label">Icon</span>
            <div className="border-base flex max-h-36 flex-wrap gap-1 overflow-auto rounded-xl border p-2">
              <button type="button" onClick={() => setIcon("")} className={`rounded-lg px-2 py-1 text-xs ${icon === "" ? "bg-brand-600 text-white" : "bg-surface-2"}`}>Default</button>
              {icons.map((k) => (
                <button key={k} type="button" title={k} aria-label={k} onClick={() => setIcon(k)} className={`rounded-lg p-1.5 ${icon === k ? "bg-brand-600 text-white" : "hover:bg-[var(--surface-2)]"}`}>
                  <ToolIcon name={k} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-1 sm:grid-cols-3">
          <Toggle name="enabled" label="Active" defaultChecked={tool.enabled} hint="Deactivated tools return 404 and leave the sitemap." />
          <Toggle name="popular" label="Popular" defaultChecked={tool.popular} hint="Shown on the home and category pages." />
          <Toggle name="searchVisible" label="Visible in search" defaultChecked={tool.searchVisible} hint="Site search and the all-tools filter." />
        </div>
        <div className="mt-4">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="customRelated" className="accent-brand-600" checked={custom} onChange={(e) => (setCustom(e.target.checked), !e.target.checked && setRelated(defaults.related))} /> Custom related tools</label>
          <div className={`mt-2 ${custom ? "" : "pointer-events-none opacity-50"}`}>
            <div className="flex flex-wrap gap-2">
              {related.map((id) => (
                <span key={id} className="chip">{name(id)} <button type="button" aria-label={`Remove ${name(id)}`} onClick={() => setRelated(related.filter((x) => x !== id))}>×</button></span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <select className="field max-w-sm" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Add a related tool…</option>
                {allTools.filter((t) => !related.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button type="button" className="btn btn-secondary" disabled={!pick || related.length >= 12} onClick={() => (setRelated([...related, pick]), setPick(""))}>Add</button>
            </div>
          </div>
        </div>
        <div className="mt-5"><SubmitButton>Save general settings</SubmitButton></div>
      </AdminForm>
    </Card>
  );
}
