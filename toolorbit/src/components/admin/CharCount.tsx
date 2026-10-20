"use client";

import { useState } from "react";

/** Input with a live character counter and recommended range. */
export function CountedInput({ label, name, defaultValue, placeholder, min, max, multiline, hint }: { label: string; name: string; defaultValue?: string | null; placeholder?: string; min: number; max: number; multiline?: boolean; hint?: string }) {
  const [v, setV] = useState(defaultValue ?? "");
  const len = v.length;
  const effective = len || (placeholder?.length ?? 0);
  const tone = !len ? "text-muted" : len < min || len > max ? "text-amber-600" : "text-emerald-600";
  return (
    <label className="block">
      <span className="label flex justify-between">
        <span>{label}</span>
        <span className={`font-mono text-xs ${tone}`}>{len ? `${len} chars` : `default: ${effective} chars`} · ideal {min}–{max}</span>
      </span>
      {multiline ? (
        <textarea className="field !font-sans !text-sm" name={name} rows={3} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} />
      ) : (
        <input className="field" name={name} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} />
      )}
      {hint && <span className="text-muted mt-1 block text-xs">{hint}</span>}
    </label>
  );
}
