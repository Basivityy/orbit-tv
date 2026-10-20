#!/usr/bin/env bash
# Zero-surprise update: pull, build a new tagged image, back up the DB, migrate, switch.
# The previous tag is recorded so scripts/rollback.sh can return to it.
set -euo pipefail
cd "$(dirname "$0")/.."

CURRENT_TAG="$(grep -E '^APP_TAG=' .env | cut -d= -f2)"
BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"

echo "==> Fetching ${BRANCH}"
git fetch origin "$BRANCH"
git merge --ff-only "origin/$BRANCH"
NEW_TAG="$(git rev-parse --short HEAD)"
if [[ "$NEW_TAG" == "$CURRENT_TAG" ]]; then echo "Already at ${NEW_TAG}."; exit 0; fi

echo "==> Building ${NEW_TAG}"
APP_TAG="$NEW_TAG" docker compose build app migrate

echo "==> Backing up database before migrating"
./scripts/backup.sh

echo "==> Applying migrations"
APP_TAG="$NEW_TAG" docker compose --profile tools run --rm migrate

echo "==> Switching app ${CURRENT_TAG} → ${NEW_TAG}"
echo "$CURRENT_TAG" > .previous_tag
sed -i "s|^APP_TAG=.*|APP_TAG=${NEW_TAG}|" .env
docker compose up -d app

echo "==> Waiting for health"
for i in $(seq 1 30); do
  if docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    echo "✔ ${NEW_TAG} is healthy"
    docker compose exec -T nginx sh -c 'rm -rf /var/cache/nginx/pages/*' || true
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 2
done
echo "✖ New version failed its health check — rolling back"
./scripts/rollback.sh
exit 1
