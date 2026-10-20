"use client";

/** Favorites and recently used tools, stored only in the visitor's browser (localStorage). */
import { useEffect, useState, useSyncExternalStore } from "react";
import { Clock, Heart } from "lucide-react";
import { ToolCard, type ToolCardData } from "./ToolCard";

const FAV = "fav-tools";
const RECENT = "recent-tools";
const listeners = new Set<() => void>();

function read(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 50) : [];
  } catch {
    return [];
  }
}
function write(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* storage blocked */
  }
  cacheSnap.delete(key);
  listeners.forEach((l) => l());
}
const cacheSnap = new Map<string, string>();
function useList(key: string): string[] {
  const raw = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => e.key === key && (cacheSnap.delete(key), cb());
      window.addEventListener("storage", onStorage);
      return () => (listeners.delete(cb), window.removeEventListener("storage", onStorage));
    },
    () => {
      if (!cacheSnap.has(key)) cacheSnap.set(key, JSON.stringify(read(key)));
      return cacheSnap.get(key)!;
    },
    () => "[]",
  );
  return JSON.parse(raw);
}

export function FavoriteButton({ id }: { id: string }) {
  const favs = useList(FAV);
  const on = favs.includes(id);
  return (
    <button
      type="button"
      className={`btn btn-secondary btn-sm ${on ? "!border-rose-300 !text-rose-600 dark:!border-rose-800" : ""}`}
      aria-pressed={on}
      onClick={() => write(FAV, on ? favs.filter((x) => x !== id) : [id, ...favs].slice(0, 50))}
    >
      <Heart className={`h-4 w-4 ${on ? "fill-current" : ""}`} aria-hidden /> {on ? "Saved" : "Save"}
    </button>
  );
}

/** Records a visit (recent list) and a page view for analytics. */
export function ToolVisit({ id }: { id: string }) {
  useEffect(() => {
    const prev = read(RECENT).filter((x) => x !== id);
    write(RECENT, [id, ...prev].slice(0, 12));
    try {
      navigator.sendBeacon?.("/api/track", new Blob([JSON.stringify({ kind: "view", key: id })], { type: "application/json" }));
    } catch {
      /* ignore */
    }
  }, [id]);
  return null;
}

export function MyTools({ tools }: { tools: ToolCardData[] }) {
  const favs = useList(FAV);
  const recent = useList(RECENT);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const byId = new Map(tools.map((t) => [t.id, t]));
  const favTools = favs.map((id) => byId.get(id)).filter(Boolean) as ToolCardData[];
  const recentTools = recent.map((id) => byId.get(id)).filter(Boolean).slice(0, 8) as ToolCardData[];
  if (!favTools.length && !recentTools.length) return null;
  return (
    <div className="space-y-8">
      {favTools.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Heart className="h-5 w-5 text-rose-500" aria-hidden /> Your favorites</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{favTools.map((t) => <ToolCard key={t.id} tool={t} compact />)}</div>
        </section>
      )}
      {recentTools.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Clock className="h-5 w-5 text-brand-500" aria-hidden /> Recently used</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => write(RECENT, [])}>Clear</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{recentTools.map((t) => <ToolCard key={t.id} tool={t} compact />)}</div>
        </section>
      )}
    </div>
  );
}

/** Tracks page views for non-tool pages. */
export function PageViewTracker({ path }: { path: string }) {
  useEffect(() => {
    try {
      navigator.sendBeacon?.("/api/track", new Blob([JSON.stringify({ kind: "view", key: path })], { type: "application/json" }));
    } catch {
      /* ignore */
    }
  }, [path]);
  return null;
}
