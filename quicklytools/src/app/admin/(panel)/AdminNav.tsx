"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, ArrowRightLeft, FileText, History, Layers, LayoutDashboard, Megaphone, Search, ShieldCheck, Users, Wrench } from "lucide-react";

const ICONS = { layout: LayoutDashboard, wrench: Wrench, search: Search, layers: Layers, history: History, file: FileText, megaphone: Megaphone, redirect: ArrowRightLeft, users: Users, shield: ShieldCheck, alert: AlertTriangle } as const;

export function AdminNav({ items }: { items: { href: string; label: string; icon: string }[] }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path === href || (path.startsWith(href + "/") && !items.some((i) => i.href !== href && i.href.startsWith(href) && path.startsWith(i.href))));
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible" aria-label="Admin">
      {items.map((i) => {
        const Icon = ICONS[i.icon as keyof typeof ICONS];
        const active = isActive(i.href);
        return (
          <Link key={i.href} href={i.href} className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300" : "text-muted hover:bg-[var(--surface-2)] hover:text-[var(--text)]"}`}>
            <Icon className="h-4 w-4" aria-hidden /> {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
