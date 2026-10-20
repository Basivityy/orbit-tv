#!/usr/bin/env bash
# Returns the app container to the previously deployed image tag.
# Database migrations are additive by convention; if a migration must be undone,
# restore the backup taken by update.sh (scripts/restore.sh).
set -euo pipefail
cd "$(dirname "$0")/.."
PREV="${1:-$(cat .previous_tag 2>/dev/null || true)}"
if [[ -z "$PREV" ]]; then echo "No previous tag recorded. Usage: $0 <tag>"; docker image ls quicklytools-app; exit 1; fi
if ! docker image inspect "quicklytools-app:${PREV}" >/dev/null 2>&1; then
  echo "Image quicklytools-app:${PREV} not found locally. Rebuilding from git…"
  git checkout "$PREV" -- . && APP_TAG="$PREV" docker compose build app
fi
CUR="$(grep -E '^APP_TAG=' .env | cut -d= -f2)"
sed -i "s|^APP_TAG=.*|APP_TAG=${PREV}|" .env
echo "$CUR" > .previous_tag
docker compose up -d app
docker compose exec -T nginx sh -c 'rm -rf /var/cache/nginx/pages/*' || true
echo "✔ Rolled back to ${PREV} (previous: ${CUR})"
