# Scarlet Satellite Blog

Next.js App Router, PostgreSQL, Prisma ve Redis kullanan üretim blog/Wiki platformu.
Uygulama, worker, Nginx, PostgreSQL, Redis ve Certbot Docker Compose ile yönetilir.
Domain ve URL kaynak kodda sabit değildir; `APP_DOMAIN`, `APP_URL` ve
`TRUSTED_HOSTS` üzerinden değiştirilir.

## Hızlı başlangıç

```sh
cp .env.example .env
# .env içindeki tüm CHANGE/replace değerlerini değiştirin
docker compose -f docker-compose.yml -f docker-compose.prod.yml config
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose ps
curl -fsS https://"$APP_DOMAIN"/health
```

Migration ve idempotent ilk kurulum seed'i uygulama entrypoint'i tarafından
başlangıçta çalıştırılır. Elle doğrulamak için:

```sh
docker compose exec app ./node_modules/.bin/prisma migrate status
docker compose logs -f --tail=200 app worker nginx certbot
```

Ayrıntılı ilk kurulum [DEPLOYMENT.md](DEPLOYMENT.md), ortam değişkenleri
[ENVIRONMENT.md](ENVIRONMENT.md), yedekleme [BACKUP_RESTORE.md](BACKUP_RESTORE.md),
güvenlik [SECURITY.md](SECURITY.md) ve sürüm yükseltme [UPGRADE.md](UPGRADE.md)
dosyalarındadır.

