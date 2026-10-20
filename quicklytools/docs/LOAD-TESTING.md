# Load testing (k6)

The goal is that **10,000 concurrent visitors** can use simple tools without CPU load on the VPS growing proportionally. The architecture supports this:

* ~all tools run in the browser — using a tool costs the server nothing after the page loads;
* public pages are ISR-rendered once and cached by Next.js, nginx (30 s micro-cache with request collapsing) and Cloudflare (edge cache);
* the database is touched only when a cache tag is invalidated by an admin, plus one batched analytics write every 30 s.

**Capacity is only proven by running these tests against your real infrastructure.** No numbers in this repository should be read as a guarantee.

## Install k6

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

Run the load generator on a **different machine** than the server under test.

## Profiles

| Profile | Command | Duration |
|---|---|---|
| 100 VUs | `k6 run -e BASE_URL=https://example.com -e PROFILE=100 load-tests/k6-site.js` | ~3 min |
| 1,000 VUs | `… -e PROFILE=1000 …` | ~4.5 min |
| 5,000 VUs | `… -e PROFILE=5000 …` | ~10 min |
| 10,000 VUs | `… -e PROFILE=10000 …` | ~15 min |

Each virtual user opens a random popular tool page, downloads its JS/CSS chunks, sometimes loads the search index, sends the analytics beacon, "works" for 3–10 s (in-browser) and sometimes browses a category page.

### Cache-hit vs cache-miss

* `CACHE_MODE=hit` (default): realistic — Cloudflare/nginx serve most HTML. Check `cdn_cache_hit` in the summary (expect > 90 % after warm-up).
* `CACHE_MODE=miss`: every page URL gets a unique query string, so CDN and nginx caches are bypassed and Next.js renders/serves from its own ISR cache. This is the origin's worst case. Run it with smaller profiles first (100 → 1000).

Test both against the **origin directly** (e.g. via a hosts entry or a grey-cloud test hostname) and **through Cloudflare** to see the CDN's effect.

### Thresholds (test fails if exceeded)

* error rate < 1 %
* pages p95 < 800 ms, p99 < 2 s; static assets p95 < 300 ms; APIs p95 < 500 ms

### Generating 5,000–10,000 VUs

One machine can typically drive 2,000–5,000 VUs for this script (it is I/O-light thanks to think time). For larger runs use [Grafana Cloud k6](https://grafana.com/products/cloud/k6/) (`k6 cloud run …`) or split the load across several runners with `--execution-segment`:

```bash
# runner 1 of 2
k6 run --execution-segment "0:1/2"   --execution-segment-sequence "0,1/2,1" -e PROFILE=10000 -e BASE_URL=… load-tests/k6-site.js
# runner 2 of 2
k6 run --execution-segment "1/2:1"   --execution-segment-sequence "0,1/2,1" -e PROFILE=10000 -e BASE_URL=… load-tests/k6-site.js
```

Raise file descriptor limits on runners: `ulimit -n 250000`.

### Rate limiting interplay

nginx limits ~30 req/s per IP (burst 60). A single runner IP generating thousands of VUs will hit these limits — that's the protection working. For capacity tests either run from many IPs (cloud) or temporarily raise the `general` zone rate on a staging server. The summary reports `rate_limited_429`.

## What to watch on the server

```bash
docker stats                       # CPU / memory per container
docker compose logs -f nginx | grep -o 'cache=[A-Z]*' | sort | uniq -c   # nginx cache status
```

Record results (k6 summary JSON is saved to `load-tests/results/`) together with server size and Cloudflare settings. Only then state a supported concurrency figure.

## Status in this repository

The k6 scripts are provided and syntax-checked, but **no 1,000+ VU test has been executed** against production infrastructure as part of development — capacity is therefore *not* confirmed yet. Run the profiles above on your VPS before announcing capacity.
