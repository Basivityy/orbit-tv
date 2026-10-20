# Cloudflare setup

Cloudflare (free plan) provides global caching, DDoS protection, Brotli, HTTP/3 and hides your origin IP.

## 1. Add the site

1. Add your domain in the Cloudflare dashboard and change the nameservers at your registrar.
2. DNS: `A @ → <server IPv4>` and `AAAA @ → <server IPv6>` (if available), **Proxied (orange cloud)**. `CNAME www → @`, proxied.

## 2. TLS — Origin Certificate + Full (strict)

1. **SSL/TLS → Origin Server → Create Certificate** (RSA, hostnames `example.com, *.example.com`, 15 years).
2. Save the certificate as `deploy/certs/fullchain.pem` and the private key as `deploy/certs/privkey.pem` on the server (`chmod 600 deploy/certs/privkey.pem`).
3. `docker compose restart nginx`
4. **SSL/TLS → Overview → Full (strict).**
5. **SSL/TLS → Edge Certificates:** Always Use HTTPS = on, Minimum TLS 1.2, HSTS can be enabled once everything works.

Origin certificates are trusted only by Cloudflare — keep the proxy (orange cloud) enabled.

## 3. Real visitor IPs

nginx trusts `CF-Connecting-IP` only from Cloudflare's IP ranges (`deploy/nginx/snippets/cloudflare-realip.conf`). Refresh the list occasionally:

```bash
./scripts/update-cloudflare-ips.sh
```

Optionally restrict ports 80/443 to Cloudflare IPs in `ufw` so the origin can't be reached directly.

## 4. Caching rules (important for 10,000+ concurrent visitors)

By default Cloudflare does **not** cache HTML. The app sends `Cache-Control: s-maxage=3600, stale-while-revalidate` on public pages, so enable edge caching with **Rules → Cache Rules**:

| Rule | Expression | Action |
|---|---|---|
| 1. Bypass private | `starts_with(http.request.uri.path, "/admin") or starts_with(http.request.uri.path, "/api/")` | **Bypass cache** |
| 2. Cache pages | `http.request.method eq "GET" and not starts_with(http.request.uri.path, "/admin") and not starts_with(http.request.uri.path, "/api/")` | **Eligible for cache**, Edge TTL: *Use cache-control header if present*, Browser TTL: *Respect origin* |

Place rule 1 above rule 2. `/_next/static/*` files are immutable (`max-age=31536000, immutable`) and cached automatically.

Also recommended:

* **Caching → Configuration:** Browser Cache TTL "Respect Existing Headers".
* **Speed → Optimization:** Brotli on, Early Hints on, HTTP/3 on. Leave Rocket Loader **off** (it can break hydration and AdSense).
* **Security:** Bot Fight Mode on; a rate-limiting rule for `/admin/login` (e.g. 10 requests/minute per IP) adds defence in depth.

## 5. Instant purge after admin edits

Create an API token with **Zone → Cache Purge → Purge** for your zone and set in `.env`:

```
CF_API_TOKEN=...
CF_ZONE_ID=...      # Overview page → API → Zone ID
```

Then `docker compose up -d app`. SEO, tool and content edits purge the affected URLs (site-wide settings purge everything). Without a token, edge copies expire according to `s-maxage` (1 hour).

## 6. Verify

```bash
curl -sI https://example.com/tools/merge-pdf | grep -i -E "cf-cache-status|cache-control"
# cf-cache-status: HIT on the second request
curl -sI https://example.com/admin/login | grep -i cf-cache-status   # BYPASS / DYNAMIC
```
