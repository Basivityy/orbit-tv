import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-muted text-sm">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />}
            {it.href && i < items.length - 1 ? (
              <Link href={it.href} className="hover:text-[var(--text)]">{it.name}</Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className={i === items.length - 1 ? "text-[var(--text)]" : ""}>{it.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
