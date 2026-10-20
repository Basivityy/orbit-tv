"use client";

import { useState } from "react";
import { AdminForm, Card } from "@/components/admin/Form";
import { bulkSeoAction } from "../../../actions";

interface Row { toolId: string; name: string; before: string; after: string }

export function BulkEditor({ tools, categories, fields }: { tools: { id: string; name: string; category: string }[]; categories: { id: string; name: string }[]; fields: { key: string; label: string; kind: string }[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [field, setField] = useState(fields[0].key);
  const [mode, setMode] = useState<"set" | "template" | "reset">("template");
  const [preview, setPreview] = useState<Row[] | null>(null);
  const kind = fields.find((f) => f.key === field)?.kind;
  const toggleCat = (cat: string) => {
    const ids = tools.filter((t) => t.category === cat).map((t) => t.id);
    const all = ids.every((id) => selected.includes(id));
    setSelected(all ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
    setPreview(null);
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <Card title={`Tools (${selected.length} selected)`}>
        <div className="mb-3 flex flex-wrap gap-1">
          <button type="button" className="chip" onClick={() => (setSelected(tools.map((t) => t.id)), setPreview(null))}>All</button>
          <button type="button" className="chip" onClick={() => (setSelected([]), setPreview(null))}>None</button>
          {categories.map((c) => <button key={c.id} type="button" className="chip" onClick={() => toggleCat(c.id)}>{c.name}</button>)}
        </div>
        <div className="max-h-[480px] space-y-0.5 overflow-auto">
          {tools.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-brand-600" checked={selected.includes(t.id)} onChange={(e) => (setSelected(e.target.checked ? [...selected, t.id] : selected.filter((x) => x !== t.id)), setPreview(null))} />
              {t.name}
            </label>
          ))}
        </div>
      </Card>
      <Card title="Change">
        <AdminForm action={bulkSeoAction} onResult={(s) => setPreview(s.ok && Array.isArray(s.data) ? (s.data as Row[]) : null)}>
          {() => (
            <>
              <input type="hidden" name="toolIds" value={JSON.stringify(selected)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="label">Field</span>
                  <select className="field" name="field" value={field} onChange={(e) => (setField(e.target.value), setPreview(null))}>{fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
                </label>
                <label className="block"><span className="label">Operation</span>
                  <select className="field" name="mode" value={mode} onChange={(e) => (setMode(e.target.value as typeof mode), setPreview(null))}>
                    <option value="template">Template</option><option value="set">Set exact value</option><option value="reset">Reset to default</option>
                  </select>
                </label>
              </div>
              {mode !== "reset" && (kind === "bool" ? (
                <label className="mt-4 block"><span className="label">Value</span><select className="field max-w-xs" name="value" onChange={() => setPreview(null)}><option value="true">true</option><option value="false">false</option></select></label>
              ) : (
                <>
                  <label className="mt-4 block"><span className="label">{mode === "template" ? "Template" : "Value"}</span><textarea className="field !font-sans" name="value" rows={3} onChange={() => setPreview(null)} placeholder={mode === "template" ? "{name} – Free Online {category} Tool | YourSite" : ""} /></label>
                  {mode === "template" && (
                    <>
                      <p className="text-muted mt-1 text-xs">Placeholders: {"{name}"}, {"{category}"}, {"{description}"}, {"{current}"} (the current value).</p>
                      <label className="mt-3 block"><span className="label">Find (optional) — replace this text inside the current value with the template result</span><input className="field" name="find" onChange={() => setPreview(null)} /></label>
                    </>
                  )}
                </>
              ))}
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="submit" name="step" value="preview" className="btn btn-secondary" disabled={!selected.length}>Preview changes</button>
                {preview && preview.length > 0 && (
                  <button type="submit" name="step" value="apply" className="btn btn-primary" onClick={(e) => { if (!confirm(`Publish ${preview.length} change(s)?`)) e.preventDefault(); }}>
                    Publish {preview.length} change(s)
                  </button>
                )}
              </div>
              {preview && (
                <div className="mt-5 max-h-[420px] overflow-auto rounded-xl border border-[var(--border)]">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-2 sticky top-0 text-left"><tr><th className="px-2 py-1.5">Tool</th><th className="px-2 py-1.5">Before</th><th className="px-2 py-1.5">After</th></tr></thead>
                    <tbody>
                      {preview.map((r) => (
                        <tr key={r.toolId} className="border-t border-[var(--border)] align-top">
                          <td className="px-2 py-1.5 font-semibold">{r.name}</td>
                          <td className="px-2 py-1.5 text-red-700 dark:text-red-300">{r.before}</td>
                          <td className="px-2 py-1.5 text-emerald-700 dark:text-emerald-300">{r.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </AdminForm>
      </Card>
    </div>
  );
}
