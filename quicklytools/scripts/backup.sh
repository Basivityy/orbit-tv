#!/usr/bin/env bash
# Compressed logical backup of PostgreSQL with rotation. Copy backups off-server
# (e.g. rclone/restic to object storage) for real disaster recovery.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$DIR"; chmod 700 "$DIR"
FILE="$DIR/${POSTGRES_DB}-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --format=plain | gzip -9 > "$FILE"
chmod 600 "$FILE"
gzip -t "$FILE"
echo "✔ Backup written: $FILE ($(du -h "$FILE" | cut -f1))"
find "$DIR" -name "*.sql.gz" -mtime +"$KEEP_DAYS" -delete
