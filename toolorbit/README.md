# ToolOrbit — browser-first online tools platform

**180 free online tools** (image, PDF, text, developer, calculators, generators, browser/privacy, utilities) with a full admin panel, per-tool SEO management, Google AdSense integration and a production deployment for Ubuntu 24.04 + Docker Compose.

* **Private & cheap to run:** ~99 % of tools run entirely in the visitor's browser (Canvas, Web Workers, WebAssembly, pdf-lib, PDF.js). Files are never uploaded. Only *What Is My IP* and the IPv6 checker need a (tiny) server request.
* **Fast:** public pages are ISR-rendered and cached by Next.js, nginx (micro-cache) and Cloudflare. Each tool's code is lazy-loaded per category; heavy libraries (PDF.js, AVIF/HEIC codecs, Terser) load only when used.
* **SEO:** unique content per tool, server-rendered metadata, canonical URLs, Open Graph/Twitter images, JSON-LD (WebApplication, BreadcrumbList, HowTo, FAQPage), XML sitemap, robots.txt, 301 redirect manager.
* **Admin (`/admin`):** dashboard, tools manager, SEO manager, bulk SEO editor with preview, SEO history with revert, content manager, ads manager, redirects, users & roles, audit log, error log.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL 17 · Prisma 6 · Argon2id · Docker Compose · nginx · Cloudflare · Vitest · Playwright · k6

## Quick start (development)

```bash
cp .env.example .env            # set DATABASE_URL to a local PostgreSQL
npm ci
npx prisma migrate dev
ADMIN_EMAIL=you@example.com npm run admin:create
npm run dev                     # http://localhost:3000, admin at /admin
```

Local dev needs `DATABASE_URL`, `SITE_URL=http://localhost:3000` and `INTERNAL_API_SECRET` (any 32+ chars).

## Quality gates

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint (next/core-web-vitals)
npm test            # Vitest unit tests (tool logic, PDF ops, security helpers, content quality)
npm run build       # production build
BASE_URL=http://localhost:3000 npm run test:e2e -- --project=chromium   # Playwright E2E (all 180 tool pages + flows)
```

See [docs/TESTING.md](docs/TESTING.md) for the cross-browser matrix.

## Documentation

| Topic | File |
|---|---|
| Architecture & performance design | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Install on Ubuntu, update, rollback, backups | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Cloudflare (CDN, caching rules, purge) | [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md) |
| TLS certificates | [docs/SSL.md](docs/SSL.md) |
| Domain & search consoles | [docs/DOMAIN.md](docs/DOMAIN.md) |
| AdSense & consent | [docs/ADSENSE.md](docs/ADSENSE.md) |
| Adding a new tool | [docs/ADDING-TOOLS.md](docs/ADDING-TOOLS.md) |
| Testing | [docs/TESTING.md](docs/TESTING.md) |
| Load testing (k6) | [docs/LOAD-TESTING.md](docs/LOAD-TESTING.md) |
| Tool list & limitations | [docs/TOOLS.md](docs/TOOLS.md) |
