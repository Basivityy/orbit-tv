"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { AdPosition } from "@/lib/settings-schema";
import { useAds } from "./AdsProvider";

/**
 * A single AdSense unit. Policy safeguards:
 * - clearly labelled "Advertisement" and visually separated from tool controls;
 * - never placed inside tool UIs, next to download buttons or in navigation;
 * - fixed minimum height to avoid layout shift (CLS).
 */
export function AdSlot({ position, allowed = true, className = "" }: { position: AdPosition; allowed?: boolean; className?: string }) {
  const ads = useAds();
  const ref = useRef<HTMLModElement>(null);
  const pathname = usePathname();
  const slotId = ads?.config.slots[position];
  const show = !!ads && ads.config.enabled && allowed && !!slotId && ads.scriptReady && !ads.config.blockedPaths.includes(pathname);

  useEffect(() => {
    if (!show || !ref.current || ref.current.dataset.adsbygoogleStatus) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || ([] as unknown as Window["adsbygoogle"]))!.push({});
    } catch {
      /* ad blockers or not yet ready */
    }
  }, [show, pathname]);

  if (!show) return null;
  return (
    <aside className={`ad-slot mx-auto w-full ${position === "sidebar" ? "min-h-[600px]" : "min-h-[100px]"} ${className}`} aria-label="Advertisement">
      <p className="text-muted mb-1 text-center text-[10px] tracking-widest uppercase">Advertisement</p>
      <ins
        key={pathname}
        ref={ref}
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={ads!.config.publisherId}
        data-ad-slot={slotId}
        data-ad-format={position === "sidebar" ? "vertical" : "auto"}
        data-full-width-responsive="true"
      />
    </aside>
  );
}
