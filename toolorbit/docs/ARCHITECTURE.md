# Architecture

```
Browser ──HTTPS──► Cloudflare edge cache ──► nginx (TLS, rate limits, 30 s micro-cache)
                                               │
                                               ▼
                                     Next.js app (standalone, non-root)
                                     ├─ ISR pages (tag-cached data layer)
                                     ├─ Server Actions (admin, auth)
                                     ├─ Middleware (301 redirect manager, in-memory rules)
                                     └─ tiny APIs: /api/ip, /api/track, /api/health
                                               │  (only on cache miss / admin writes)
                                               ▼
                                         PostgreSQL 17 (private network)
```

## Code layout

```
src/
  tools/
    types.ts, categories.ts, registry.ts   tool registry (ids, metadata) — server & client safe
    content/<category>.ts                   unique SEO content per tool (intro, steps, notes, FAQ, keywords)
    logic/*.ts                              pure, unit-tested logic (text, JSON/YAML/CSV, finance, units, colors, PDF ops, image bytes…)
    ui/*.tsx                                reusable tool engines: TextTransformTool, FormCalculator, ImageBatch, kit
    imaging/                                image pipeline + Web Worker (OffscreenCanvas) + HEIC/AVIF/SVG decoding
    pdf/render.ts                           lazy PDF.js loader & renderer
    impl/<category>.tsx                     one lazily-loaded chunk per category mapping tool id → component
    ToolRenderer.tsx                        client loader with error boundary
  lib/
    data.ts, data-catalog.ts                tag-cached catalog/settings/pages; merges DB overrides over code defaults
    auth.ts, password.ts                    Argon2id, sessions, roles/permissions
    seo.ts, seo-service.ts                  metadata/JSON-LD builders; SEO changes with history & revert
    revalidate.ts                           tag revalidation + Cloudflare purge
    analytics.ts                            in-memory buffered daily counters (batched UPSERT)
    rate-limit.ts, request.ts               sliding-window limiter, trusted client IP
  app/
    (site)/                                 public pages (home, /tools, /tools/[slug], /category/[slug], static pages)
    admin/                                  login + panel (server components + server actions)
    api/                                    health, ip, track, report-error, internal/revalidate
    sitemap.ts, robots.ts, ads.txt, search-index.json, opengraph-image
  middleware.ts                             redirect manager (Node runtime)
prisma/schema.prisma                        overrides, SEO + history, pages, settings, redirects, stats, logs, users
```

## Data model: code defaults + admin overrides

Tool **functionality** is code. Everything editorial is data:

* `ToolOverride` — name, category, description, icon, enabled, popular, order, search visibility, related tools.
* `ToolSeo` — slug, title, description, canonical, robots, OG/Twitter, H1, intro, body (Markdown), FAQ, internal links, structured-data switch. `null` = use code default.
* `SeoRevision` — field-level history (who, when, old, new, batch) → revert single changes or whole batches.
* `CategoryOverride`, `SitePage`, `Setting` (site, home, nav, footer, ads), `Redirect`.

`buildCatalog()` merges these onto the registry. Public pages read the merged catalog through `unstable_cache` with tags (`catalog`, `settings`, `pages`); **the database is not queried per page view**. Admin writes call `revalidateTag()` plus an optional Cloudflare purge, so the next request renders fresh server HTML (what search engines see).

Admins can create/edit pages only for implemented tool types; adding new functionality requires code + deploy ([ADDING-TOOLS.md](ADDING-TOOLS.md)).

## Performance design (target: 10,000 concurrent visitors)

| Concern | Measure |
|---|---|
| Server CPU per visitor | Tools run client-side; server only serves cached HTML/JS. |
| HTML rendering | ISR (1 h + on-demand tag revalidation); nginx 30 s micro-cache with `proxy_cache_lock` and `use_stale updating`; Cloudflare edge cache. |
| JS size | Shared first load ≈103 kB; tool page ≈129 kB. Category chunks load after hydration; heavy libs are dynamic imports. |
| Heavy work | Image pipeline in a Web Worker (OffscreenCanvas) with main-thread fallback; AVIF/HEIC via WebAssembly; PDF.js has its own worker. |
| Memory limits | Images ≤50 MB / 100 MP, PDFs ≤200 MB, text ≤5 M chars, sequential batch processing, object URLs revoked. |
| Database | Queried only on cache miss/revalidation and admin actions; analytics buffered in memory and flushed every 30 s in one UPSERT. |
| Abuse | nginx `limit_req`/`limit_conn`; app limits on login (10/15 min/IP + account lockout), `/api/ip` (30/min), `/api/track` (120/min), error reports (10/min + global 60/min); body size limits. |
| Core Web Vitals | System font stack (no font download), reserved ad heights (CLS), tool UI mounts into a fixed-height placeholder. |

## Security

* Argon2id (m=19 MiB, t=2, p=1) password hashes; SHA-256-hashed session tokens; cookies `HttpOnly; Secure; SameSite=Strict; __Host-` prefix; 12 h sliding sessions; lockout after 8 failures.
* CSRF: all mutations are Server Actions (Next.js verifies `Origin` vs `Host`) + SameSite=Strict cookies.
* Roles: OWNER (users) ⊃ ADMIN (tools, ads, redirects, logs) ⊃ EDITOR (SEO, content) ⊃ VIEWER (dashboard). Checked server-side in every page and action.
* Input validation with Zod on every action; Prisma parameterised queries (no string SQL); Markdown sanitised with sanitize-html; JSON-LD escaped.
* Headers: CSP (AdSense-compatible allowlist; stricter CSP on /admin), HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
* SSRF: the server never fetches user-supplied URLs (QR/OG previews are rendered by the visitor's browser). The only outbound call is the Cloudflare purge to a fixed host.
* Audit log for logins and every admin change; error log with rate-limited ingestion.

### CSP note

Public pages are ISR-cached HTML, which cannot carry per-request nonces, and Next.js injects inline bootstrap scripts; therefore `script-src` includes `'unsafe-inline'` on public pages (plus Google ad domains). All other directives are locked down (`object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'`). XSS defence relies on React escaping and server-side sanitisation of admin Markdown.
