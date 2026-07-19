#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Kullanım: $0 /backups/YYYYMMDDTHHMMSSZ" >&2
  exit 64
fi

backup_dir=$1
test -f "$backup_dir/postgres.dump"
test -f "$backup_dir/uploads.tar.gz"
(cd "$backup_dir" && sha256sum -c SHA256SUMS)

docker compose stop app worker
docker compose exec -T postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB" && PGPASSWORD="$POSTGRES_PASSWORD" createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  < "$backup_dir/postgres.dump"

uploads_volume=$(docker inspect "$(docker compose ps -q app)" --format '{{range .Mounts}}{{if eq .Destination "/app/storage/uploads"}}{{.Name}}{{end}}{{end}}')
test -n "$uploads_volume"
docker run --rm \
  -v "$uploads_volume:/target" \
  -v "$backup_dir:/backup:ro" \
  alpine:3.22 \
  sh -ec 'find /target -mindepth 1 -delete; tar -xzf /backup/uploads.tar.gz -C /target'

docker compose up -d app worker
echo "Geri yükleme tamamlandı."
