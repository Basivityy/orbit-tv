"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ClearButton, StatGrid, useReportUse, type Stat } from "./kit";

export interface TextStatsConfig {
  stats: (text: string, extra: Record<string, number>) => Stat[];
  placeholder?: string;
  /** Optional numeric settings (e.g. words per minute). */
  settings?: { name: string; label: string; default: number; min: number; max: number }[];
  footer?: (text: string) => ReactNode;
}

export function TextStatsTool({ stats, placeholder, settings, footer }: TextStatsConfig) {
  const [text, setText] = useState("");
  const [extra, setExtra] = useState<Record<string, number>>(() => Object.fromEntries((settings ?? []).map((s) => [s.name, s.default])));
  const deferred = useDeferredValue(text);
  const report = useReportUse();
  const reported = useRef(false);
  const result = useMemo(() => stats(deferred, extra), [deferred, extra, stats]);

  useEffect(() => {
    if (deferred.trim() && !reported.current) {
      reported.current = true;
      report();
    }
  }, [deferred, report]);

  return (
    <div className="space-y-4">
      <StatGrid stats={result} columns={4} />
      {settings && (
        <div className="flex flex-wrap gap-4">
          {settings.map((s) => (
            <label key={s.name} className="text-sm">
              <span className="label">{s.label}</span>
              <input
                type="number"
                className="field w-32"
                min={s.min}
                max={s.max}
                value={extra[s.name]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v >= s.min && v <= s.max) setExtra((p) => ({ ...p, [s.name]: v }));
                }}
              />
            </label>
          ))}
        </div>
      )}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="stats-input" className="label mb-0">
            Your text
          </label>
          {text && <ClearButton onClick={() => setText("")} />}
        </div>
        <textarea
          id="stats-input"
          className="field !font-sans !text-base"
          rows={14}
          value={text}
          placeholder={placeholder ?? "Start typing or paste your text here…"}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      {footer?.(deferred)}
    </div>
  );
}
