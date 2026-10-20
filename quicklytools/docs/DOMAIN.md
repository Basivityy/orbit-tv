# Connecting a domain

1. Buy/choose a domain at any registrar.
2. **With Cloudflare (recommended):** add the site to Cloudflare and set the two Cloudflare nameservers at your registrar. Then create records in Cloudflare (proxied):
   * `A  @    <server IPv4>`
   * `AAAA @  <server IPv6>` (if your VPS has IPv6)
   * `CNAME www @`
3. **Without Cloudflare:** create the same `A`/`AAAA`/`CNAME` records at your DNS provider.
4. Set `SERVER_NAME` and `SITE_URL` in `.env` (done by `install.sh`) and restart: `docker compose up -d`.
5. Install TLS ([SSL.md](SSL.md)).

## Optional: IPv6 test hostname

The IPv6 Support Checker can only give a definitive answer with a hostname that has **only an AAAA record**:

* `AAAA ipv6 <server IPv6>` (no A record; with Cloudflare set it to **DNS only**, because Cloudflare's proxy accepts IPv4 too).
* Add `ipv6.example.com` to the certificate and `server_name` in `deploy/nginx/templates/site.conf.template`.
* Set `NEXT_PUBLIC_IPV6_TEST_URL=https://ipv6.example.com/api/ip` in `.env` and rebuild (`./scripts/update.sh`).

## Search engines

1. Google Search Console: add the domain property, paste the verification code into **Admin → Content → Site settings**, submit `https://example.com/sitemap.xml`.
2. Bing Webmaster Tools: same, with the Bing verification code.
3. AdSense: add the site; `/ads.txt` is generated automatically once the publisher ID is saved in **Admin → Ads manager**.
