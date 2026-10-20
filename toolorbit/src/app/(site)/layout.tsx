import type { Metadata } from "next";
import { getCatalog, getSettings } from "@/lib/data";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { AdsProvider, type PublicAdsConfig } from "@/components/ads/AdsProvider";
import { AdSlot } from "@/components/ads/AdSlot";
import { ConsentBanner } from "@/components/ads/ConsentBanner";
import { AD_POSITIONS } from "@/lib/settings-schema";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: `${s.site.name} – Free Online Tools`, template: `%s | ${s.site.name}` },
    description: s.site.tagline,
    applicationName: s.site.name,
    verification: {
      google: s.site.googleSiteVerification || undefined,
      other: s.site.bingSiteVerification ? { "msvalidate.01": s.site.bingSiteVerification } : undefined,
    },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const catalog = await getCatalog();
  const blockedPaths = catalog.tools
    .filter((t) => s.ads.disabledTools.includes(t.id) || s.ads.disabledCategories.includes(t.category))
    .map((t) => `/tools/${t.slug}`);
  const ads: PublicAdsConfig = {
    enabled: s.ads.enabled,
    publisherId: s.ads.publisherId,
    slots: Object.fromEntries(AD_POSITIONS.filter((p) => s.ads.slots[p]?.enabled && s.ads.slots[p]?.slotId).map((p) => [p, s.ads.slots[p].slotId])),
    consentMode: s.ads.consentMode,
    euOnlyBanner: s.ads.euOnlyBanner,
    blockedPaths,
  };
  return (
    <AdsProvider config={ads}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Header siteName={s.site.name} links={s.nav.links} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <AdSlot position="belowHeader" className="mt-4" />
      </div>
      <main id="main">{children}</main>
      <Footer siteName={s.site.name} footer={s.footer} showConsentLink={s.ads.enabled && s.ads.consentMode === "builtin"} />
      <ConsentBanner />
    </AdsProvider>
  );
}
