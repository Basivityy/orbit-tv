"use client";

import { useState } from "react";
import { AD_POSITIONS, AD_POSITION_LABELS, type AdsSettings } from "@/lib/settings-schema";
import { AdminForm, Card, SubmitButton } from "@/components/admin/Form";
import { saveAdsAction } from "../../actions";

export function AdsForm({ value, categories, tools }: { value: AdsSettings; categories: { id: string; name: string }[]; tools: { id: string; name: string }[] }) {
  const [v, setV] = useState(value);
  const [pick, setPick] = useState("");
  return (
    <AdminForm action={saveAdsAction} className="space-y-5">
      {(state) => (
        <>
          <input type="hidden" name="value" value={JSON.stringify(v)} />
          <Card title="Account">
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} /> Show ads on the public site</label>
            <label className="mt-4 block max-w-md"><span className="label">AdSense publisher ID</span><input className="field font-mono" placeholder="ca-pub-1234567890123456" value={v.publisherId} onChange={(e) => setV({ ...v, publisherId: e.target.value.trim() })} /></label>
            {state.fieldErrors?.publisherId && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.publisherId}</p>}
            <p className="text-muted mt-2 text-xs">/ads.txt is generated automatically from this ID. Only add ad units that AdSense has approved for this site.</p>
          </Card>
          <Card title="Ad positions" description="Enter the numeric ad unit (data-ad-slot) ID for each position you want to use.">
            <div className="space-y-3">
              {AD_POSITIONS.map((p) => (
                <div key={p} className="grid items-center gap-2 sm:grid-cols-[220px_1fr]">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={v.slots[p].enabled} onChange={(e) => setV({ ...v, slots: { ...v.slots, [p]: { ...v.slots[p], enabled: e.target.checked } } })} /> {AD_POSITION_LABELS[p]}</label>
                  <input className="field font-mono" placeholder="Ad unit ID, e.g. 1234567890" value={v.slots[p].slotId} onChange={(e) => setV({ ...v, slots: { ...v.slots, [p]: { ...v.slots[p], slotId: e.target.value.trim() } } })} />
                </div>
              ))}
            </div>
            <p className="text-muted mt-3 text-xs">Placement rules built in: every ad is labelled “Advertisement”, kept outside the tool interface, separated from download buttons and results, and reserves its height to avoid layout shift. The admin area never shows ads.</p>
          </Card>
          <Card title="Exclusions">
            <span className="label">Disable ads for categories</span>
            <div className="flex flex-wrap gap-3">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="accent-brand-600" checked={v.disabledCategories.includes(c.id)} onChange={(e) => setV({ ...v, disabledCategories: e.target.checked ? [...v.disabledCategories, c.id] : v.disabledCategories.filter((x) => x !== c.id) })} /> {c.name}</label>
              ))}
            </div>
            <span className="label mt-4">Disable ads on specific tools</span>
            <div className="flex flex-wrap gap-2">
              {v.disabledTools.map((id) => <span key={id} className="chip">{tools.find((t) => t.id === id)?.name ?? id} <button type="button" onClick={() => setV({ ...v, disabledTools: v.disabledTools.filter((x) => x !== id) })}>×</button></span>)}
            </div>
            <div className="mt-2 flex gap-2">
              <select className="field max-w-sm" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Add tool…</option>{tools.filter((t) => !v.disabledTools.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              <button type="button" className="btn btn-secondary" disabled={!pick} onClick={() => (setV({ ...v, disabledTools: [...v.disabledTools, pick] }), setPick(""))}>Add</button>
            </div>
          </Card>
          <Card title="Consent & privacy">
            <div className="space-y-2 text-sm">
              <label className="flex items-start gap-2"><input type="radio" name="cm" className="mt-1 accent-brand-600" checked={v.consentMode === "google-cmp"} onChange={() => setV({ ...v, consentMode: "google-cmp" })} /><span><strong>Google Privacy & messaging (recommended for EEA/UK/CH traffic).</strong> Google requires a Google-certified CMP for personalised ads in these regions. Create the GDPR message in AdSense → Privacy & messaging; it is shown by the AdSense tag automatically. Consent Mode defaults to “denied” until the message is answered.</span></label>
              <label className="flex items-start gap-2"><input type="radio" name="cm" className="mt-1 accent-brand-600" checked={v.consentMode === "builtin"} onChange={() => setV({ ...v, consentMode: "builtin" })} /><span><strong>Built-in banner.</strong> A simple accept/reject banner wired to Google Consent Mode v2; rejected visitors get non-personalised ads. Suitable for US/opt-out regimes; it is <em>not</em> a Google-certified CMP.</span></label>
              <label className="flex items-start gap-2"><input type="radio" name="cm" className="mt-1 accent-brand-600" checked={v.consentMode === "none"} onChange={() => setV({ ...v, consentMode: "none" })} /><span><strong>None.</strong> Only if you have no visitors from regions that require consent.</span></label>
            </div>
            {v.consentMode === "builtin" && (
              <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={v.euOnlyBanner} onChange={(e) => setV({ ...v, euOnlyBanner: e.target.checked })} /> Show the banner only to visitors whose time zone is in Europe (others get an opt-out link in the footer)</label>
            )}
            <label className="mt-4 block"><span className="label">Additional ads.txt lines (other ad partners)</span><textarea className="field" rows={3} value={v.adsTxtExtra} onChange={(e) => setV({ ...v, adsTxtExtra: e.target.value })} /></label>
          </Card>
          {state.fieldErrors && <ul className="text-xs text-red-600">{Object.entries(state.fieldErrors).map(([k, m]) => <li key={k}>{k}: {m}</li>)}</ul>}
          <SubmitButton>Save ad settings</SubmitButton>
        </>
      )}
    </AdminForm>
  );
}
