import Link from "next/link";
import { LogoMark } from "./Logo";
import { SearchBox } from "./SearchBox";
import { ThemeToggle } from "./ThemeToggle";
import { MobileMenu } from "./MobileMenu";

export function Header({ siteName, links }: { siteName: string; links: { label: string; href: string }[] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight" aria-label={`${siteName} home`}>
          <LogoMark />
          <span className="text-lg">{siteName}</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-muted rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden w-full max-w-xs md:block">
          <SearchBox />
        </div>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <ThemeToggle />
          <MobileMenu links={links} />
        </div>
      </div>
    </header>
  );
}
