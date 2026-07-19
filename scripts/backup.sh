#!/bin/sh
set -eu

umask 077
backup_dir=${BACKUP_DIR:-/backups}
retention_days=${BACKUP_RETENTION_DAYS:-14}
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
work_dir="$backup_dir/$timestamp"
mkdir -p "$work_dir"

docker compose exec -T postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner' \
  > "$work_dir/postgres.dump"

uploads_volume=$(docker inspect "$(docker compose ps -q app)" --format '{{range .Mounts}}{{if eq .Destination "/app/storage/uploads"}}{{.Name}}{{end}}{{end}}')
test -n "$uploads_volume"
docker run --rm \
  -v "$uploads_volume:/source:ro" \
  -v "$work_dir:/backup" \
  alpine:3.22 \
  tar -czf /backup/uploads.tar.gz -C /source .

sha256sum "$work_dir/postgres.dump" "$work_dir/uploads.tar.gz" > "$work_dir/SHA256SUMS"

if [ -n "${BACKUP_ENCRYPTION_RECIPIENT:-}" ]; then
  command -v age >/dev/null 2>&1 || {
    echo "BACKUP_ENCRYPTION_RECIPIENT ayarlı ancak age bulunamadı." >&2
    exit 1
  }
  tar -C "$work_dir" -czf - postgres.dump uploads.tar.gz SHA256SUMS |
    age -r "$BACKUP_ENCRYPTION_RECIPIENT" -o "$backup_dir/$timestamp.tar.gz.age"
  rm -rf "$work_dir"
fi

find "$backup_dir" -mindepth 1 -maxdepth 1 -mtime "+$retention_days" -exec rm -rf -- {} +
echo "Yedek tamamlandı: $timestamp"
