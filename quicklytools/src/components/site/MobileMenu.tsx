"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { SearchBox } from "./SearchBox";

export function MobileMenu({ links }: { links: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <div className="md:hidden">
      <button type="button" className="btn btn-ghost !p-2" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
      </button>
      {/* Portalled to <body>: the header's backdrop-filter would otherwise become the
          containing block of this fixed panel and clip it to the header's height. */}
      {open && createPortal(
        <div className="bg-surface fixed inset-x-0 top-16 bottom-0 z-50 overflow-auto border-t border-[var(--border)] p-4 animate-fade-in">
          <SearchBox />
          <nav className="mt-4 flex flex-col" aria-label="Mobile">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg px-3 py-3 text-base font-medium hover:bg-[var(--surface-2)]">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>,
        document.body,
      )}
    </div>
  );
}
