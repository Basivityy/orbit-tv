# Google AdSense & consent

All ad settings live in **Admin → Ads manager** (role ADMIN or OWNER). Nothing is hard-coded.

## Setup

1. Get your site approved in AdSense (the site needs real content — every tool page has unique text — plus About, Contact and Privacy pages, which exist by default).
2. Enter the **publisher ID** (`ca-pub-…`). `/ads.txt` is generated automatically (`google.com, pub-…, DIRECT, f08c47fec0942fa0`). Extra partner lines can be added.
3. Create **display ad units** in AdSense (responsive) and paste their numeric IDs into the positions you want:

| Position | Where it appears |
|---|---|
| Below header | Under the site header on every public page |
| Below tool title | Between the tool heading and the tool interface |
| Below tool interface | After the tool, separated by spacing, before the explanatory content |
| Desktop sidebar | Right column on wide screens (≥1280 px), sticky |
| Between content sections | Between the article text and the FAQ; also on home/category pages |

4. Choose exclusions (categories or individual tools without ads).
5. Tick **Show ads** and save. Pages update immediately (cache invalidation).

## Policy safeguards built into the templates

* Every unit is labelled **“Advertisement”** and rendered in its own `<aside>`.
* Ads are never placed inside the tool interface, next to download/copy buttons, in navigation or in result areas, so they cannot be mistaken for tool controls or results.
* Ad containers reserve height (no layout shift; protects Core Web Vitals).
* No ads in the admin area, on 404 pages within the admin, or on excluded tools.
* No pop-ups, interstitials or auto-refreshing units are implemented.

Still your responsibility: don't click your own ads, don't encourage clicks, keep content compliant with AdSense program policies.

## Consent (GDPR/UK GDPR/ePrivacy, CCPA/CPRA)

Three modes:

1. **Google Privacy & messaging (recommended when you have EEA/UK/Swiss visitors).** Since January 2024 Google requires a *Google-certified CMP* to serve personalised ads in these regions. In AdSense → Privacy & messaging create a GDPR message (and optionally a US state regulations message). The AdSense tag shows it automatically. The site sets Google Consent Mode v2 defaults to *denied* until the message is answered.
2. **Built-in banner.** A lightweight accept/reject banner wired to Consent Mode v2. Rejecting requests non-personalised ads. A “Cookie settings” link in the footer lets visitors change their choice. Optional: show it only to visitors whose device time zone is in Europe (pages are CDN-cached, so IP-based geo-targeting is not possible without breaking caching). This banner is **not** a Google-certified CMP — use mode 1 for EEA traffic.
3. **None** — only if you have no visitors from regions requiring consent.

The privacy policy template (Admin → Content → privacy-policy) already describes Google's use of cookies, opt-out links and visitor rights. Review it with counsel.

## Content Security Policy

The CSP allows Google ad, measurement and Funding Choices domains (`*.googlesyndication.com`, `*.doubleclick.net`, `*.google.com`, `*.gstatic.com`, `*.adtrafficquality.google`, `fundingchoicesmessages.google.com`). If Google adds new domains, extend `adsDomains` in `next.config.ts` and redeploy.
