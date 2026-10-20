"use client";

import Link from "next/link";
import { useAds } from "./AdsProvider";

export function ConsentBanner() {
  const ads = useAds();
  if (!ads || !ads.config.enabled || ads.config.consentMode !== "builtin" || !ads.bannerOpen) return null;
  return (
    <div role="dialog" aria-live="polite" aria-label="Cookie consent" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl animate-fade-in">
      <div className="surface rounded-2xl p-4 shadow-2xl sm:p-5">
        <p className="text-sm leading-relaxed">
          We use cookies from Google to show ads that keep these tools free. With your consent, ads can be personalised; otherwise you&apos;ll see non-personalised ads. Your files are never uploaded either way.{" "}
          <Link href="/privacy-policy" className="text-brand-600 underline dark:text-brand-300">Privacy policy</Link>
        </p>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => ads.setConsent("denied")}>Reject personalised ads</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => ads.setConsent("granted")}>Accept</button>
        </div>
      </div>
    </div>
  );
}

export function ConsentSettingsLink() {
  const ads = useAds();
  if (!ads || !ads.config.enabled || ads.config.consentMode !== "builtin") return null;
  return (
    <button type="button" className="underline hover:text-[var(--text)]" onClick={ads.openBanner}>
      Cookie settings
    </button>
  );
}
