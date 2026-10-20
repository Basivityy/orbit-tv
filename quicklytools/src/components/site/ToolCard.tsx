import Link from "next/link";
import { ToolIcon } from "../icons";

export interface ToolCardData {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  popular?: boolean;
}

export function ToolCard({ tool, compact }: { tool: ToolCardData; compact?: boolean }) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group surface relative flex gap-3 rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-600/5 dark:hover:border-brand-700"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-900/40 dark:text-brand-300">
        <ToolIcon name={tool.icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold leading-snug">{tool.name}</span>
        {!compact && <span className="text-muted mt-1 line-clamp-2 block text-sm leading-relaxed">{tool.description}</span>}
      </span>
    </Link>
  );
}

export function ToolGrid({ tools, compact }: { tools: ToolCardData[]; compact?: boolean }) {
  return (
    <div className={`grid gap-3 ${compact ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
      {tools.map((t) => (
        <ToolCard key={t.id} tool={t} compact={compact} />
      ))}
    </div>
  );
}
