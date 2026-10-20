"use client";

import { Component, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { TOOL_LOADERS } from "./loaders";
import type { CategoryId } from "./types";
import { ToolContext } from "./ui/kit";
import { reportClientError } from "@/lib/client-errors";

class ToolErrorBoundary extends Component<{ children: ReactNode; toolId: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    reportClientError(error, `tool:${this.props.toolId}`);
  }
  render() {
    if (this.state.error)
      return (
        <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-semibold">Something went wrong in this tool.</p>
          <p className="mt-1">{this.state.error.message}</p>
          <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    return this.props.children;
  }
}

/** Loads and renders a tool's interactive UI on the client only. */
export function ToolRenderer({ toolId, implCategory }: { toolId: string; implCategory: CategoryId }) {
  const [Tool, setTool] = useState<ComponentType | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    TOOL_LOADERS[implCategory]()
      .then((m) => {
        const C = m.default[toolId];
        if (!alive) return;
        if (C) setTool(() => C);
        else setFailed(true);
      })
      .catch((e) => {
        reportClientError(e, `load:${toolId}`);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [toolId, implCategory]);

  if (failed)
    return (
      <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        The tool could not be loaded. Check your connection and reload the page.
      </div>
    );
  if (!Tool)
    return (
      <div className="text-muted flex min-h-64 items-center justify-center gap-2 text-sm" aria-busy="true">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading tool…
      </div>
    );
  return (
    <ToolContext.Provider value={{ toolId }}>
      <ToolErrorBoundary toolId={toolId}>
        <Tool />
      </ToolErrorBoundary>
    </ToolContext.Provider>
  );
}
