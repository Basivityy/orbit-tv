"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Checkbox, DataTable, ErrorBox, Field, NumberInput, Select, StatGrid, useReportUse, type Stat } from "./kit";

export type CalcField =
  | {
      name: string; label: string; type: "number"; default: string; min?: number; max?: number; step?: number;
      prefix?: string; suffix?: string; hint?: string; optional?: boolean; showIf?: (v: CalcValues) => boolean;
    }
  | { name: string; label: string; type: "select"; default: string; options: { value: string; label: string }[]; hint?: string; showIf?: (v: CalcValues) => boolean }
  | { name: string; label: string; type: "date" | "time" | "datetime-local" | "text"; default: string; hint?: string; optional?: boolean; placeholder?: string; showIf?: (v: CalcValues) => boolean }
  | { name: string; label: string; type: "checkbox"; default: boolean; hint?: string; showIf?: (v: CalcValues) => boolean };

export type CalcValues = Record<string, string | boolean>;

export interface CalcOutput {
  stats: Stat[];
  table?: { columns: string[]; rows: (string | number)[][]; title?: string };
  note?: ReactNode;
  extra?: ReactNode;
}

export interface CalcHelpers {
  /** Parse a numeric field; throws a friendly error if missing or invalid. */
  n: (name: string) => number;
  /** Parse an optional numeric field; returns fallback when empty. */
  opt: (name: string, fallback?: number) => number;
  s: (name: string) => string;
  b: (name: string) => boolean;
}

export interface FormCalculatorConfig {
  fields: CalcField[];
  compute: (h: CalcHelpers, values: CalcValues) => CalcOutput;
  formula?: ReactNode;
  statColumns?: 2 | 3 | 4;
  /** Number of form columns on desktop. */
  formColumns?: 1 | 2 | 3;
}

export function FormCalculator({ fields, compute, formula, statColumns = 3, formColumns = 2 }: FormCalculatorConfig) {
  const defaults = useMemo(() => Object.fromEntries(fields.map((f) => [f.name, f.default])) as CalcValues, [fields]);
  const [values, setValues] = useState<CalcValues>(defaults);
  const [touched, setTouched] = useState(false);
  const report = useReportUse();
  const reportedRef = useRef(false);

  const visible = fields.filter((f) => !f.showIf || f.showIf(values));

  const result = useMemo((): { out?: CalcOutput; error?: string } => {
    const label = (name: string) => fields.find((f) => f.name === name)?.label ?? name;
    const h: CalcHelpers = {
      n: (name) => {
        const raw = String(values[name] ?? "").trim();
        if (raw === "") throw new Error(`Enter a value for “${label(name)}”.`);
        const v = Number(raw);
        if (!Number.isFinite(v)) throw new Error(`“${label(name)}” must be a number.`);
        const f = fields.find((x) => x.name === name);
        if (f && f.type === "number") {
          if (f.min !== undefined && v < f.min) throw new Error(`“${label(name)}” must be at least ${f.min}.`);
          if (f.max !== undefined && v > f.max) throw new Error(`“${label(name)}” must be at most ${f.max}.`);
        }
        return v;
      },
      opt: (name, fallback = 0) => {
        const raw = String(values[name] ?? "").trim();
        if (raw === "") return fallback;
        const v = Number(raw);
        if (!Number.isFinite(v)) throw new Error(`“${label(name)}” must be a number.`);
        return v;
      },
      s: (name) => String(values[name] ?? ""),
      b: (name) => Boolean(values[name]),
    };
    try {
      return { out: compute(h, values) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [values, compute, fields]);

  useEffect(() => {
    if (touched && result.out && !reportedRef.current) {
      reportedRef.current = true;
      report();
    }
  }, [touched, result.out, report]);

  const set = (name: string, v: string | boolean) => {
    setTouched(true);
    setValues((p) => ({ ...p, [name]: v }));
  };

  const gridCols = formColumns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : formColumns === 1 ? "" : "sm:grid-cols-2";

  return (
    <div className="space-y-5">
      <form className={`grid grid-cols-1 gap-4 ${gridCols}`} onSubmit={(e) => e.preventDefault()} noValidate>
        {visible.map((f) => {
          const id = `calc-${f.name}`;
          if (f.type === "checkbox")
            return (
              <div key={f.name} className="flex items-end pb-2">
                <Checkbox checked={Boolean(values[f.name])} onChange={(v) => set(f.name, v)} label={f.label} />
              </div>
            );
          return (
            <Field key={f.name} label={f.label + (("optional" in f && f.optional) ? " (optional)" : "")} htmlFor={id} hint={f.hint}>
              {f.type === "number" ? (
                <NumberInput id={id} value={String(values[f.name] ?? "")} onChange={(v) => set(f.name, v)} min={f.min} max={f.max} step={f.step} prefix={f.prefix} suffix={f.suffix} />
              ) : f.type === "select" ? (
                <Select id={id} value={String(values[f.name])} onChange={(v) => set(f.name, v)} options={f.options} />
              ) : (
                <input
                  id={id}
                  type={f.type}
                  className="field"
                  value={String(values[f.name] ?? "")}
                  placeholder={"placeholder" in f ? f.placeholder : undefined}
                  step={f.type === "time" ? 1 : undefined}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
            </Field>
          );
        })}
      </form>

      <div className="flex justify-end">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setValues(defaults)}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset
        </button>
      </div>

      <div aria-live="polite">
        {result.error ? (
          <ErrorBox message={result.error} />
        ) : result.out ? (
          <div className="space-y-4">
            <StatGrid stats={result.out.stats} columns={statColumns} />
            {result.out.note && <p className="text-muted text-sm">{result.out.note}</p>}
            {result.out.extra}
            {result.out.table && result.out.table.rows.length > 0 && (
              <div>
                {result.out.table.title && <h3 className="mb-2 text-sm font-semibold">{result.out.table.title}</h3>}
                <DataTable columns={result.out.table.columns} rows={result.out.table.rows} />
              </div>
            )}
          </div>
        ) : null}
      </div>

      {formula && (
        <details className="bg-surface-2 rounded-xl px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold">Formula used</summary>
          <div className="text-muted mt-2 space-y-1 font-mono text-xs leading-relaxed">{formula}</div>
        </details>
      )}
    </div>
  );
}
