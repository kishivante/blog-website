# Yedekleme ve Geri Yükleme

## Günlük yedek

Script PostgreSQL'i custom formatta, upload volume'unu sıkıştırılmış arşiv
olarak alır; SHA-256 manifesti üretir, `umask 077` kullanır ve varsayılan 14
gün retention uygular.

```sh
sudo install -d -m 700 /var/backups/scarlet
BACKUP_DIR=/var/backups/scarlet BACKUP_RETENTION_DAYS=14 ./scripts/backup.sh
```

Cron örneği (`crontab -e`, her gün 03:20):

```cron
20 3 * * * cd /opt/scarlet-blog && BACKUP_DIR=/var/backups/scarlet ./scripts/backup.sh >>/var/log/scarlet-backup.log 2>&1
```

Yedeği farklı fiziksel sisteme kopyalayın ve düzenli restore tatbikatı yapın.
Opsiyonel `BACKUP_ENCRYPTION_RECIPIENT` age alıcısı verilirse script şifreli
`.tar.gz.age` üretir; hostta `age` kurulu olmalıdır. Anahtarı yedekle aynı
konumda tutmayın.

## Restore

Bakım penceresi açın, mevcut durumun ayrıca yedeğini alın ve doğru `.env` ile:

```sh
BACKUP_DIR=/var/backups/scarlet ./scripts/backup.sh
./scripts/restore.sh /var/backups/scarlet/20260719T032000Z
docker compose ps
curl -fsS https://"$APP_DOMAIN"/health
```

Restore app/worker'ı durdurur, checksum doğrular, veritabanını ve upload
volume'unu geri yükler, sonra servisleri başlatır. Şifreli yedeği önce güvenli
bir geçici dizine `age -d` ile açın. PostgreSQL major sürümü değişiyorsa
hedef sürümle `pg_restore` uyumluluğunu staging ortamında doğrulayın.

