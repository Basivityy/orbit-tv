"use client";

/** Shared client-side building blocks for tool interfaces. */
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, Copy, Download, Upload, X } from "lucide-react";

// ---------- Usage tracking ----------

export const ToolContext = createContext<{ toolId: string }>({ toolId: "" });

const reported = new Set<string>();

/** Reports one "use" per tool per page load. Aggregated server-side, no personal data. */
export function reportToolUse(toolId: string) {
  if (!toolId || reported.has(toolId) || typeof navigator === "undefined") return;
  reported.add(toolId);
  const body = JSON.stringify({ kind: "use", key: toolId });
  try {
    if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    else void fetch("/api/track", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
  } catch {
    /* analytics must never break a tool */
  }
}

export function useReportUse() {
  const { toolId } = useContext(ToolContext);
  return useCallback(() => reportToolUse(toolId), [toolId]);
}

// ---------- Files ----------

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadText(text: string, filename: string, mime = "text/plain;charset=utf-8") {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(2)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export interface FileDropProps {
  accept: string;
  multiple?: boolean;
  maxSizeMB: number;
  maxFiles?: number;
  onFiles: (files: File[]) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
}

export function FileDrop({ accept, multiple, maxSizeMB, maxFiles = 50, onFiles, label, hint, disabled }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const accepts = useCallback(
    (f: File) => {
      const rules = accept.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (rules.length === 0) return true;
      const name = f.name.toLowerCase();
      const type = (f.type || "").toLowerCase();
      return rules.some((r) => (r.startsWith(".") ? name.endsWith(r) : r.endsWith("/*") ? type.startsWith(r.slice(0, -1)) : type === r));
    },
    [accept],
  );

  const handle = (list: FileList | null) => {
    if (!list || disabled) return;
    setError(null);
    const files = Array.from(list);
    const problems: string[] = [];
    const ok = files.filter((f) => {
      if (!accepts(f)) return problems.push(`${f.name}: unsupported file type`), false;
      if (f.size === 0) return problems.push(`${f.name}: file is empty`), false;
      if (f.size > maxSizeMB * 1024 * 1024) return problems.push(`${f.name}: larger than ${maxSizeMB} MB`), false;
      return true;
    });
    if (!multiple && ok.length > 1) ok.splice(1);
    if (ok.length > maxFiles) {
      problems.push(`Only the first ${maxFiles} files were added.`);
      ok.splice(maxFiles);
    }
    if (problems.length) setError(problems.join(" · "));
    if (ok.length) onFiles(ok);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          drag ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20" : "border-base hover:border-brand-400 bg-surface-2"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/25">
          <Upload className="h-5 w-5" aria-hidden />
        </span>
        <span className="text-base font-semibold">{label ?? (multiple ? "Choose files or drop them here" : "Choose a file or drop it here")}</span>
        <span className="text-muted text-xs">{hint ?? `Max ${maxSizeMB} MB${multiple ? " per file" : ""}. Processed on your device — nothing is uploaded.`}</span>
        <input ref={inputRef} id={id} type="file" accept={accept} multiple={multiple} className="sr-only" onChange={(e) => handle(e.target.files)} disabled={disabled} />
      </label>
      {error && <ErrorBox message={error} className="mt-3" />}
    </div>
  );
}

// ---------- Feedback ----------

export function ErrorBox({ message, className = "" }: { message: string; className?: string }) {
  return (
    <div role="alert" className={`flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 ${className}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span className="break-words">{message}</span>
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "warn" }) {
  const cls =
    tone === "success"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
      : tone === "warn"
        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200";
  return <div className={`rounded-xl border px-3 py-2.5 text-sm ${cls}`}>{children}</div>;
}

export function CopyButton({ text, label = "Copy", className = "", disabled }: { text: string; label?: string; className?: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  const report = useReportUse();
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className={`btn btn-secondary btn-sm ${className}`}
      disabled={disabled || !text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          report();
        } catch {
          // Fallback for browsers without async clipboard permission.
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
          setCopied(true);
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function DownloadButton({
  onClick,
  label = "Download",
  disabled,
  primary = true,
}: {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
  primary?: boolean;
}) {
  const report = useReportUse();
  return (
    <button
      type="button"
      className={`btn ${primary ? "btn-primary" : "btn-secondary"}`}
      disabled={disabled}
      onClick={() => {
        report();
        onClick();
      }}
    >
      <Download className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}

export function ClearButton({ onClick, label = "Clear" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={onClick}>
      <X className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

// ---------- Form controls ----------

export function Field({ label, htmlFor, hint, children, className = "" }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="text-muted mt-1 text-xs">{hint}</p>}
    </div>
  );
}

export function NumberInput({
  id, value, onChange, min, max, step, suffix, prefix, placeholder, invalid,
}: {
  id?: string; value: string; onChange: (v: string) => void; min?: number; max?: number; step?: number | "any";
  suffix?: string; prefix?: string; placeholder?: string; invalid?: boolean;
}) {
  return (
    <div className="relative flex items-center">
      {prefix && <span className="text-muted pointer-events-none absolute left-3 text-sm">{prefix}</span>}
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className={`field ${prefix ? "pl-7" : ""} ${suffix ? "pr-12" : ""}`}
        value={value}
        min={min}
        max={max}
        step={step ?? "any"}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {suffix && <span className="text-muted pointer-events-none absolute right-3 text-sm">{suffix}</span>}
    </div>
  );
}

export function Select<T extends string>({
  id, value, onChange, options,
}: {
  id?: string; value: T; onChange: (v: T) => void; options: readonly { value: T; label: string }[];
}) {
  return (
    <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm select-none">
      <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Range({
  id, value, onChange, min, max, step = 1, label, display,
}: {
  id?: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; label: string; display?: string;
}) {
  const auto = useId();
  const rid = id ?? auto;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={rid} className="label mb-0">
          {label}
        </label>
        <span className="text-muted font-mono text-xs">{display ?? value}</span>
      </div>
      <input id={rid} type="range" className="w-full accent-brand-600" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, ariaLabel,
}: {
  value: T; onChange: (v: T) => void; options: readonly { value: T; label: string }[]; ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="bg-surface-2 inline-flex flex-wrap gap-1 rounded-xl p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${value === o.value ? "bg-surface text-brand-700 shadow-sm dark:text-brand-300" : "text-muted hover:text-[var(--text)]"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Results ----------

export interface Stat {
  label: string;
  value: ReactNode;
  primary?: boolean;
  hint?: string;
}

export function StatGrid({ stats, columns = 3 }: { stats: Stat[]; columns?: 2 | 3 | 4 }) {
  const cols = columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <dl className={`grid grid-cols-1 gap-3 ${cols}`}>
      {stats.map((s) => (
        <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.primary ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/20" : "border-base bg-surface"}`}>
          <dt className="text-muted text-xs font-medium">{s.label}</dt>
          <dd className={`mt-1 font-semibold tabular-nums break-words ${s.primary ? "text-2xl text-brand-700 dark:text-brand-300" : "text-lg"}`}>{s.value}</dd>
          {s.hint && <p className="text-muted mt-0.5 text-xs">{s.hint}</p>}
        </div>
      ))}
    </dl>
  );
}

export function DataTable({ columns, rows, maxHeight = 420 }: { columns: string[]; rows: (string | number)[][]; maxHeight?: number }) {
  return (
    <div className="border-base overflow-auto rounded-xl border" style={{ maxHeight }}>
      <table className="w-full text-sm tabular-nums">
        <thead className="bg-surface-2 sticky top-0">
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col" className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-base border-t">
              {r.map((cell, j) => (
                <td key={j} className="px-3 py-1.5 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KeyValueList({ items }: { items: { k: string; v: ReactNode; copy?: string }[] }) {
  return (
    <dl className="border-base divide-y divide-[var(--border)] overflow-hidden rounded-xl border">
      {items.map((it) => (
        <div key={it.k} className="bg-surface flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4">
          <dt className="text-muted w-full shrink-0 text-xs font-semibold sm:w-48">{it.k}</dt>
          <dd className="min-w-0 flex-1 font-mono text-sm break-all">{it.v}</dd>
          {it.copy !== undefined && <CopyButton text={it.copy} className="self-start sm:self-auto" />}
        </div>
      ))}
    </dl>
  );
}

export function Panel({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`surface rounded-2xl p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export const money = (v: number, decimals = 2) =>
  Number.isFinite(v) ? v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : "—";

export const num = (v: number, maxDecimals = 4) =>
  Number.isFinite(v) ? v.toLocaleString("en-US", { maximumFractionDigits: maxDecimals }) : "—";
