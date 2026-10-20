"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { ToolGrid } from "@/components/site/ToolCard";

interface Item {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  keywords: string;
}

/** Filters the server-rendered list on the client; ?q= from the site search pre-fills it. */
export function AllToolsFilter({ tools, children }: { tools: Item[]; children: ReactNode }) {
  const [q, setQ] = useState("");
  useEffect(() => {
    const initial = new URLSearchParams(location.search).get("q");
    if (initial) setQ(initial.slice(0, 100));
  }, []);
  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return null;
    return tools.filter((t) => terms.every((term) => `${t.name} ${t.keywords} ${t.description}`.toLowerCase().includes(term)));
  }, [q, tools]);
  return (
    <>
      <div className="relative my-6 max-w-md">
        <Search className="text-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" aria-hidden />
        <input type="search" className="field !pl-9" placeholder="Filter tools…" aria-label="Filter tools" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {results === null ? (
        children
      ) : results.length ? (
        <ToolGrid tools={results} />
      ) : (
        <p className="text-muted py-10 text-center">No tools match “{q}”.</p>
      )}
    </>
  );
}
