import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser, can } from "@/lib/auth";
import { LogoMark } from "@/components/site/Logo";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { logoutAction } from "../actions";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const items = [
    { href: "/admin", label: "Dashboard", icon: "layout", show: true },
    { href: "/admin/tools", label: "Tools", icon: "wrench", show: can(user.role, "editSeo") },
    { href: "/admin/seo", label: "SEO manager", icon: "search", show: can(user.role, "editSeo") },
    { href: "/admin/seo/bulk", label: "Bulk SEO editor", icon: "layers", show: can(user.role, "editSeo") },
    { href: "/admin/seo/history", label: "SEO history", icon: "history", show: can(user.role, "editSeo") },
    { href: "/admin/content", label: "Content", icon: "file", show: can(user.role, "editContent") },
    { href: "/admin/ads", label: "Ads manager", icon: "megaphone", show: can(user.role, "manageAds") },
    { href: "/admin/redirects", label: "Redirects", icon: "redirect", show: can(user.role, "manageRedirects") },
    { href: "/admin/users", label: "Users", icon: "users", show: can(user.role, "manageUsers") },
    { href: "/admin/audit", label: "Audit log", icon: "shield", show: can(user.role, "viewAudit") },
    { href: "/admin/errors", label: "System errors", icon: "alert", show: can(user.role, "viewAudit") },
  ].filter((i) => i.show);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-[var(--border)] bg-[var(--surface)] lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <Link href="/admin" className="flex items-center gap-2 font-bold"><LogoMark className="h-6 w-6" /> Admin</Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
          </div>
        </div>
        <AdminNav items={items.map(({ show: _s, ...i }) => i)} />
        <div className="text-muted hidden border-t border-[var(--border)] p-4 text-xs lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
          <p className="truncate font-semibold text-[var(--text)]">{user.name}</p>
          <p className="truncate">{user.email} · {user.role}</p>
          <div className="mt-2 flex gap-2">
            <Link href="/admin/account" className="underline">Account</Link>
            <Link href="/" target="_blank" className="underline">View site</Link>
            <form action={logoutAction}><button className="underline">Sign out</button></form>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</div>
        <div className="text-muted flex gap-3 border-t border-[var(--border)] px-4 py-3 text-xs lg:hidden">
          <span>{user.email}</span>
          <Link href="/admin/account" className="underline">Account</Link>
          <form action={logoutAction}><button className="underline">Sign out</button></form>
        </div>
      </div>
    </div>
  );
}
