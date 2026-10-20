/**
 * k6 load test for QuicklyTools public traffic.
 *
 *   k6 run -e BASE_URL=https://example.com -e PROFILE=100   k6-site.js
 *   k6 run -e BASE_URL=https://example.com -e PROFILE=1000  k6-site.js
 *   k6 run -e BASE_URL=https://example.com -e PROFILE=5000  k6-site.js
 *   k6 run -e BASE_URL=https://example.com -e PROFILE=10000 k6-site.js
 *
 * Optional: -e CACHE_MODE=miss adds a unique query string to every page request so the
 * CDN and nginx caches are bypassed (worst case: every request reaches Next.js).
 *
 * 5,000-10,000 VUs exceed what one load generator machine can produce reliably;
 * run them from k6 Cloud or several distributed runners (see LOAD-TESTING.md).
 * A "virtual user" here is a visitor who opens a tool page, loads its assets and
 * then works in the browser — tools themselves generate no server traffic.
 */
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const PROFILE = __ENV.PROFILE || "100";
const CACHE_MODE = __ENV.CACHE_MODE || "hit";

const PROFILES = {
  100: [{ duration: "30s", target: 100 }, { duration: "2m", target: 100 }, { duration: "20s", target: 0 }],
  1000: [{ duration: "1m", target: 1000 }, { duration: "3m", target: 1000 }, { duration: "30s", target: 0 }],
  5000: [{ duration: "2m", target: 2500 }, { duration: "2m", target: 5000 }, { duration: "5m", target: 5000 }, { duration: "1m", target: 0 }],
  10000: [{ duration: "2m", target: 3000 }, { duration: "3m", target: 7000 }, { duration: "3m", target: 10000 }, { duration: "5m", target: 10000 }, { duration: "2m", target: 0 }],
};

export const options = {
  scenarios: { visitors: { executor: "ramping-vus", startVUs: 0, stages: PROFILES[PROFILE], gracefulRampDown: "30s" } },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{type:page}": ["p(95)<800", "p(99)<2000"],
    "http_req_duration{type:static}": ["p(95)<300"],
    "http_req_duration{type:api}": ["p(95)<500"],
    checks: ["rate>0.99"],
  },
  discardResponseBodies: false,
  insecureSkipTLSVerify: __ENV.INSECURE === "1",
};

const cacheHits = new Rate("cdn_cache_hit");
const rateLimited = new Counter("rate_limited_429");
const ttfb = new Trend("page_ttfb", true);

const TOOLS = [
  "merge-pdf", "image-compressor", "json-formatter", "word-counter", "qr-code-generator", "pdf-to-jpg",
  "heic-to-jpg", "password-generator", "percentage-calculator", "mortgage-calculator", "what-is-my-ip",
  "jpg-to-png", "split-pdf", "base64-encoder", "unix-timestamp-converter", "loan-calculator",
];
const PAGES = ["/", "/tools", "/category/pdf-tools", "/category/image-tools", "/about"];

function bust(path) {
  return CACHE_MODE === "miss" ? `${path}${path.includes("?") ? "&" : "?"}lt=${__VU}-${__ITER}-${Date.now()}` : path;
}

function recordCache(res) {
  const s = (res.headers["Cf-Cache-Status"] || res.headers["X-Cache"] || "").toUpperCase();
  if (s) cacheHits.add(s === "HIT" || s === "STALE" || s === "UPDATING");
}

function assetsFrom(html) {
  const out = new Set();
  const re = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html)) && out.size < 12) out.add(m[1]);
  return [...out];
}

export default function () {
  group("tool visit", () => {
    const tool = TOOLS[Math.floor(Math.random() * TOOLS.length)];
    const res = http.get(`${BASE}${bust(`/tools/${tool}`)}`, { tags: { type: "page", name: "tool-page" } });
    ttfb.add(res.timings.waiting);
    recordCache(res);
    if (res.status === 429) rateLimited.add(1);
    check(res, { "tool page 200": (r) => r.status === 200, "has h1": (r) => (r.body || "").includes("<h1") });
    const assets = assetsFrom(res.body || "");
    if (assets.length) {
      const batch = assets.map((a) => ["GET", `${BASE}${a}`, null, { tags: { type: "static", name: "static" } }]);
      const rs = http.batch(batch);
      check(rs, { "assets 200": (arr) => arr.every((r) => r.status === 200) });
    }
    // Search index is fetched when a visitor focuses the search box (~30% of visits).
    if (Math.random() < 0.3) http.get(`${BASE}/search-index.json`, { tags: { type: "static", name: "search-index" } });
    // Analytics beacon (fire-and-forget).
    http.post(`${BASE}/api/track`, JSON.stringify({ kind: "view", key: tool }), { headers: { "content-type": "application/json" }, tags: { type: "api", name: "track" } });
    if (tool === "what-is-my-ip") {
      const ip = http.get(`${BASE}/api/ip`, { tags: { type: "api", name: "ip" } });
      if (ip.status === 429) rateLimited.add(1);
    }
  });

  sleep(3 + Math.random() * 7); // user works with the tool in the browser

  if (Math.random() < 0.4) {
    group("browse", () => {
      const page = PAGES[Math.floor(Math.random() * PAGES.length)];
      const res = http.get(`${BASE}${bust(page)}`, { tags: { type: "page", name: "page" } });
      recordCache(res);
      check(res, { "page 200": (r) => r.status === 200 });
    });
    sleep(2 + Math.random() * 5);
  }
}

export function handleSummary(data) {
  const name = `load-tests/results/summary-${PROFILE}-${CACHE_MODE}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  return { [name]: JSON.stringify(data, null, 2), stdout: textSummary(data) };
}

function textSummary(d) {
  const m = d.metrics;
  const v = (k, f = "p(95)") => (m[k] && m[k].values[f] !== undefined ? m[k].values[f].toFixed(1) : "n/a");
  return [
    `\nProfile ${PROFILE} VUs, cache mode: ${CACHE_MODE}`,
    `requests: ${m.http_reqs.values.count}  failed: ${(m.http_req_failed.values.rate * 100).toFixed(2)}%`,
    `page p95: ${v("http_req_duration{type:page}")} ms   static p95: ${v("http_req_duration{type:static}")} ms   api p95: ${v("http_req_duration{type:api}")} ms`,
    `cache hit rate: ${m.cdn_cache_hit ? (m.cdn_cache_hit.values.rate * 100).toFixed(1) + "%" : "n/a"}   429s: ${m.rate_limited_429 ? m.rate_limited_429.values.count : 0}\n`,
  ].join("\n");
}
