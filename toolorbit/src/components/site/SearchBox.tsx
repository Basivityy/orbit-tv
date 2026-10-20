"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { ToolIcon } from "../icons";

export interface SearchEntry {
  id: string;
  s: string;
  n: string;
  c: string;
  i: string;
  d: string;
  k: string;
  p: number;
}

let indexPromise: Promise<SearchEntry[]> | null = null;
function loadIndex() {
  indexPromise ??= fetch("/search-index.json").then((r) => (r.ok ? r.json() : [])).catch(() => {
    indexPromise = null;
    return [];
  });
  return indexPromise;
}

export function scoreEntry(e: SearchEntry, q: string): number {
  const name = e.n.toLowerCase();
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  for (const t of terms) {
    if (name.startsWith(t)) score += 10;
    else if (name.includes(` ${t}`)) score += 7;
    else if (name.includes(t)) score += 5;
    else if (e.k.includes(t)) score += 3;
    else if (e.d.toLowerCase().includes(t)) score += 1;
    else return 0;
  }
  return score + e.p;
}

export function SearchBox({ variant = "header" }: { variant?: "header" | "hero" }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState<SearchEntry[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const ensure = useCallback(() => {
    void loadIndex().then(setIndex);
  }, []);

  useEffect(() => {
    if (variant !== "header") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName))) {
        e.preventDefault();
        setOpen(true);
        ensure();
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ensure, variant]);

  const results = useMemo(() => {
    const t = q.trim();
    if (!t) return index.filter((e) => e.p).slice(0, 8);
    return index
      .map((e) => ({ e, s: scoreEntry(e, t) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 10)
      .map((x) => x.e);
  }, [q, index]);

  const go = (e: SearchEntry) => {
    setOpen(false);
    setQ("");
    router.push(`/tools/${e.s}`);
  };

  const field = (
    <div className="relative">
      <Search className="text-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="search-results"
        aria-label="Search tools"
        autoComplete="off"
        className={`field !pl-9 ${variant === "hero" ? "!py-3.5 !text-base shadow-lg shadow-brand-600/5" : ""}`}
        placeholder={variant === "hero" ? "Search 180+ tools… e.g. “merge pdf”, “json”, “qr”" : "Search tools…"}
        value={q}
        onFocus={() => (setOpen(true), ensure())}
        onChange={(e) => (setQ(e.target.value), setActive(0), setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          }
          else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          }
          else if (e.key === "Enter") {
            e.preventDefault();
            if (results[active]) go(results[active]);
            else if (q.trim()) router.push(`/tools?q=${encodeURIComponent(q.trim())}`);
          } else if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {variant === "header" && !q && <kbd className="text-muted border-base pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border px-1.5 text-[10px] lg:block">Ctrl K</kbd>}
      {q && (
        <button type="button" aria-label="Clear search" className="text-muted absolute top-1/2 right-2 -translate-y-1/2 p-1" onMouseDown={(e) => (e.preventDefault(), setQ(""))}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
      {open && results.length > 0 && (
        <ul id="search-results" role="listbox" className="surface absolute top-full right-0 left-0 z-50 mt-2 max-h-[60vh] overflow-auto rounded-xl p-1.5 shadow-xl animate-pop">
          {!q.trim() && <li className="text-muted px-3 py-1.5 text-xs font-semibold uppercase">Popular tools</li>}
          {results.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === active ? "bg-brand-50 dark:bg-brand-900/30" : "hover:bg-[var(--surface-2)]"}`}
                onMouseDown={(e) => (e.preventDefault(), go(r))}
                onMouseEnter={() => setActive(i)}
              >
                <ToolIcon name={r.i} className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{r.n}</span>
                  <span className="text-muted block truncate text-xs">{r.d}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return field;
}
