# Testing

## Unit tests (Vitest) — `npm test`

`tests/unit/` covers the logic behind the tools and the platform:

* **text.test.ts** — word/sentence/paragraph counting (incl. emoji, CJK, hyphens), case conversion, dedupe/sort/reverse, find & replace (regex, groups, invalid patterns), slugify, lorem ipsum, binary/hex round trips and invalid input, size limits.
* **developer.test.ts** — JSON format/minify/validate with error location, JSON↔CSV, CSV dedupe, YAML, XML formatting and malformed tags, Base64/URL/HTML entities, JWT decoding, UUID v4/v7, SHA-256/HMAC known vectors, regex runner limits, timestamp unit detection, cron parsing and next-run calculation.
* **finance.test.ts** — percentages, stacked discounts, VAT, amortization against reference values, mortgage PMI rules, lease money factor, trade-in tax credit, compound interest vs closed-form, savings, ROI/CAGR, margins, break-even, salary, tips with exact cent splitting, BMI, fuel, electricity.
* **convert.test.ts** — temperature (absolute zero), data units (TB vs TiB), CSS units, big-integer base conversion, binary calculator, Roman numerals (validation), calendar diffs (month-end), business days, durations, aspect ratios, password entropy, color parsing/conversion/contrast.
* **generators.test.ts** — CSPRNG uniformity, password set guarantees, passphrases, unique random ints, Wi-Fi/mailto/tel/SMS/vCard payload escaping, UTM, robots.txt, meta/OG escaping, CSS generators.
* **imageformat.test.ts** — format sniffing, header dimensions, DPI (JFIF/pHYs), lossless JPEG/PNG metadata stripping, ICO building, CRC32, page ranges, pixel filters, blur, user-agent parsing.
* **pdf.test.ts** — real PDFs: merge, select/delete/split/rotate, metadata read/write, AES-256 encrypt → wrong password → unlock, watermark & WinAnsi replacement, page numbers, images→PDF, text→PDF pagination, signature stamping.
* **registry.test.ts** — 180 unique tools, valid icons/related links, unique & substantial SEO content, every tool implemented, admin override merging.
* **ratelimit.test.ts** — sliding-window limiter, password policy, Argon2id hashing, Markdown XSS sanitisation, JSON-LD escaping.

## E2E tests (Playwright) — `npm run test:e2e`

Run against a server: `BASE_URL=https://staging.example.com npx playwright test`.

* **all-tools.spec.ts** — for each of the 180 tools: HTTP 200, H1, canonical, meta description, the interactive UI mounts, no runtime/console errors.
* **tools-functional.spec.ts** — JSON formatter, word counter, calculators (valid + invalid input), PNG→JPG conversion & download, empty-file rejection, PDF merge (page count verified), PDF protect/unlock, QR SVG download, password length, IP lookup.
* **site.spec.ts** — home SEO/JSON-LD, search, structured data on tool pages, 404, robots/sitemap, favorites/recent (localStorage), dark mode, **API rate limiting (429 + Retry-After)**.
* **admin.spec.ts** — redirect to login + no-store headers, wrong password, SEO edit visible in public HTML then reverted, **role permissions** (editor blocked from users/ads/redirects). Requires the two e2e users documented in the file.

### Browser matrix

`playwright.config.ts` defines `chromium`, `firefox`, `webkit` (Safari engine), `edge` (`channel: msedge`), `mobile-chrome` (Pixel 7) and `mobile-safari` (iPhone 14). Install engines with `npx playwright install --with-deps` (and Microsoft Edge for the `edge` project). Real Safari on macOS/iOS should additionally be smoke-tested manually or on a device cloud — WebKit in Playwright is close to, but not identical with, shipping Safari.

### Large files & memory

Size limits are enforced in the UI (`FileDrop`) and logic (`MAX_PDF_MB`, `MAX_PIXELS`, `MAX_TEXT_LENGTH`). For memory-leak checks, use Chrome DevTools → Memory: process a batch of 20 large images twice and confirm the heap returns to baseline (object URLs are revoked and bitmaps closed after use). Large-file behaviour depends on the visitor's device and cannot be fully automated in CI.

## Load tests (k6)

See [LOAD-TESTING.md](LOAD-TESTING.md).

## Results recorded during development

* Unit: 115/115 passing.
* E2E (Chromium, against `next build` + standalone server): see the commit history / CI output. Firefox, WebKit, Edge and mobile projects were **not** executed in the development container (only Chromium is installed there) — run them in CI or locally before release.
* k6: scripts provided; **not executed at 1,000+ VUs** — capacity not yet confirmed.
