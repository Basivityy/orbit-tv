#!/usr/bin/env bash
# Restores a backup created by backup.sh. DESTRUCTIVE: replaces the current database.
set -euo pipefail
cd "$(dirname "$0")/.."
FILE="${1:-}"
[[ -f "$FILE" ]] || { echo "Usage: $0 backups/<file>.sql.gz"; exit 1; }
set -a; source .env; set +a
read -r -p "This will REPLACE database ${POSTGRES_DB} with ${FILE}. Type 'restore' to continue: " ok
[[ "$ok" == "restore" ]] || exit 1
./scripts/backup.sh  # safety copy of the current state
docker compose stop app
docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS \"${POSTGRES_DB}\" WITH (FORCE);" -c "CREATE DATABASE \"${POSTGRES_DB}\" OWNER \"${POSTGRES_USER}\";"
gunzip -c "$FILE" | docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null
docker compose start app
echo "✔ Restored ${FILE}"
