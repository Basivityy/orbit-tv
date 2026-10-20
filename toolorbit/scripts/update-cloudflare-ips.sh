#!/usr/bin/env bash
# Refreshes the trusted Cloudflare IP list used for real client IPs.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=deploy/nginx/snippets/cloudflare-realip.conf
TMP="$(mktemp)"
{
  echo "# Cloudflare IP ranges (https://www.cloudflare.com/ips/). Updated $(date -u +%F)."
  for v in v4 v6; do curl -fsS "https://www.cloudflare.com/ips-$v" | sed 's/^/set_real_ip_from /; s/$/;/'; done
  echo "real_ip_header CF-Connecting-IP;"
} > "$TMP"
grep -q set_real_ip_from "$TMP" && mv "$TMP" "$OUT"
docker compose exec -T nginx nginx -t && docker compose exec -T nginx nginx -s reload
echo "✔ Updated $OUT"
