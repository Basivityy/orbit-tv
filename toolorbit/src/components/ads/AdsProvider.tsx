"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AdPosition } from "@/lib/settings-schema";

/** Public (non-secret) ads configuration passed down from the server layout. */
export interface PublicAdsConfig {
  enabled: boolean;
  publisherId: string;
  slots: Partial<Record<AdPosition, string>>;
  consentMode: "builtin" | "google-cmp" | "none";
  euOnlyBanner: boolean;
  /** Paths where ads must not render (tools/categories excluded by the admin). */
  blockedPaths: string[];
}

type Consent = "granted" | "denied" | null;

interface AdsState {
  config: PublicAdsConfig;
  consent: Consent;
  bannerOpen: boolean;
  scriptReady: boolean;
  setConsent: (c: "granted" | "denied") => void;
  openBanner: () => void;
}

const Ctx = createContext<AdsState | null>(null);
export const useAds = () => useContext(Ctx);

const KEY = "ad-consent";

declare global {
  interface Window {
    adsbygoogle?: unknown[] & { requestNonPersonalizedAds?: number; pauseAdRequests?: number };
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function gtag(...args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

function likelyEeaVisitor(): boolean {
  // Pages are cached at the edge, so we cannot vary by IP. Time zone is a privacy-friendly heuristic.
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    return tz.startsWith("Europe/") || tz === "Atlantic/Reykjavik" || tz === "Atlantic/Canary" || tz === "Atlantic/Madeira" || tz === "Atlantic/Azores";
  } catch {
    return true;
  }
}

function loadAdSense(publisherId: string, personalized: boolean) {
  if (document.getElementById("adsbygoogle-js")) return;
  window.adsbygoogle = window.adsbygoogle || ([] as unknown as Window["adsbygoogle"]);
  if (!personalized) window.adsbygoogle!.requestNonPersonalizedAds = 1;
  const s = document.createElement("script");
  s.id = "adsbygoogle-js";
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
  document.head.appendChild(s);
}

export function AdsProvider({ config, children }: { config: PublicAdsConfig; children: ReactNode }) {
  const [consent, setConsentState] = useState<Consent>(null);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const active = config.enabled && /^ca-pub-\d+$/.test(config.publisherId);

  useEffect(() => {
    if (!active) return;
    // Consent Mode v2 defaults: everything denied until the visitor decides.
    gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied", wait_for_update: 500 });
    if (config.consentMode !== "builtin") {
      // Google's certified CMP (configured in AdSense) or no consent management.
      loadAdSense(config.publisherId, true);
      setScriptReady(true);
      return;
    }
    let saved: Consent = null;
    try {
      saved = localStorage.getItem(KEY) as Consent;
    } catch {
      /* ignore */
    }
    if (saved === "granted" || saved === "denied") {
      setConsentState(saved);
      gtag("consent", "update", { ad_storage: saved, ad_user_data: saved, ad_personalization: saved });
      loadAdSense(config.publisherId, saved === "granted");
      setScriptReady(true);
    } else if (config.euOnlyBanner && !likelyEeaVisitor()) {
      // Outside the EEA/UK: opt-out model. Personalised ads by default; the footer link lets visitors opt out.
      gtag("consent", "update", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
      loadAdSense(config.publisherId, true);
      setScriptReady(true);
    } else {
      setBannerOpen(true);
    }
  }, [active, config.consentMode, config.euOnlyBanner, config.publisherId]);

  const setConsent = useCallback(
    (c: "granted" | "denied") => {
      try {
        localStorage.setItem(KEY, c);
      } catch {
        /* ignore */
      }
      const changed = consent !== null && consent !== c;
      setConsentState(c);
      setBannerOpen(false);
      gtag("consent", "update", { ad_storage: c, ad_user_data: c, ad_personalization: c });
      if (changed) {
        // Ad requests already made used the old setting; reload to apply cleanly.
        location.reload();
        return;
      }
      loadAdSense(config.publisherId, c === "granted");
      setScriptReady(true);
    },
    [config.publisherId, consent],
  );

  return (
    <Ctx.Provider value={{ config: { ...config, enabled: active }, consent, bannerOpen, scriptReady, setConsent, openBanner: () => setBannerOpen(true) }}>
      {children}
    </Ctx.Provider>
  );
}
