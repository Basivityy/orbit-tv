import Link from "next/link";
import type { FooterSettings } from "@/lib/settings-schema";
import { LogoMark } from "./Logo";
import { ConsentSettingsLink } from "../ads/ConsentBanner";

export function Footer({ siteName, footer, showConsentLink }: { siteName: string; footer: FooterSettings; showConsentLink: boolean }) {
  const copyright = footer.copyright.replace("{year}", String(new Date().getFullYear())).replace("{siteName}", siteName);
  return (
    <footer className="mt-20 border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Link href="/" className="flex items-center gap-2 font-bold">
            <LogoMark className="h-6 w-6" />
            {siteName}
          </Link>
          <p className="text-muted mt-3 max-w-xs text-sm leading-relaxed">{footer.about}</p>
        </div>
        {footer.columns.map((col) => (
          <div key={col.title}>
            <h2 className="text-sm font-semibold">{col.title}</h2>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  {l.href.startsWith("/") ? (
                    <Link href={l.href} className="text-muted text-sm hover:text-[var(--text)]">{l.label}</Link>
                  ) : (
                    <a href={l.href} className="text-muted text-sm hover:text-[var(--text)]" rel="noopener noreferrer">{l.label}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-[var(--border)]">
        <div className="text-muted mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs sm:px-6">
          <span>{copyright}</span>
          <span className="flex items-center gap-4">
            <span>Most tools run locally in your browser.</span>
            {showConsentLink && <ConsentSettingsLink />}
          </span>
        </div>
      </div>
    </footer>
  );
}
