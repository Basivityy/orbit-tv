# TLS certificates

nginx reads the certificate from `SSL_CERT` / `SSL_KEY` (defaults: `deploy/certs/fullchain.pem` and `deploy/certs/privkey.pem`, mounted at `/etc/nginx/certs`). `install.sh` creates a 30-day self-signed placeholder so nginx can start — replace it with one of the options below.

## Option A — Cloudflare Origin Certificate (behind Cloudflare)

See [CLOUDFLARE.md](CLOUDFLARE.md#2-tls--origin-certificate--full-strict). Valid up to 15 years, no renewal needed.

## Option B — Let's Encrypt (no CDN, or Cloudflare "DNS only")

DNS must already point at the server and port 80 must be reachable.

```bash
# 1. Obtain the certificate via the webroot served by nginx
docker compose --profile certbot run --rm certbot certonly --webroot -w /var/www/certbot \
  -d example.com -d www.example.com --email you@example.com --agree-tos --no-eff-email

# 2. Point nginx at it (.env)
SSL_CERT=/etc/nginx/certs/live/example.com/fullchain.pem
SSL_KEY=/etc/nginx/certs/live/example.com/privkey.pem

# 3. Apply
docker compose up -d nginx
```

### Automatic renewal

```bash
sudo tee /etc/cron.d/toolorbit-certbot >/dev/null <<'CRON'
17 4 * * * root cd /opt/toolorbit-src/toolorbit && docker compose --profile certbot run --rm certbot renew --quiet && docker compose exec -T nginx nginx -s reload
CRON
```

## Verify

```bash
curl -vI https://example.com 2>&1 | grep -E "subject|expire|HTTP/"
```

Check the grade at https://www.ssllabs.com/ssltest/ — the shipped configuration (TLS 1.2/1.3, modern ciphers, HSTS from the app) targets an A/A+ rating.
