# Güncelleme ve Rollback

## Güncelleme

1. Güncel PostgreSQL ve upload yedeği alın.
2. Yeni kaynak/image sürümünü staging'de test edin.
3. `docker compose ... build --pull` ve `docker compose ... config` çalıştırın.
4. Bakım penceresinde `docker compose ... up -d` çalıştırın.
5. App entrypoint migration'ı uygular; health, loglar ve temel akışları kontrol edin.

```sh
./scripts/backup.sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose ps
curl -fsS https://"$APP_DOMAIN"/health
```

## Rollback

Önceki immutable image tag'ini `APP_IMAGE` olarak seçip app/worker'ı yeniden
oluşturun. Migration geriye uyumlu değilse yalnız image rollback yeterli
değildir; bakım modunda eşleşen pre-upgrade veritabanı ve upload yedeğini
`BACKUP_RESTORE.md` ile geri yükleyin. `latest` yerine sürüm/digest kullanın.
Prisma migration dosyasını üretimde elle düzenlemeyin veya silmeyin.

