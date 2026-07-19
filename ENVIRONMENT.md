# Ortam Değişkenleri

`APP_DOMAIN`, `APP_URL` ve `TRUSTED_HOSTS` public origin'i belirler. Genel site
metinleri veritabanından; sırlar yalnız `.env` üzerinden okunur.

- `DATABASE_URL`, `POSTGRES_*`: internal PostgreSQL bağlantısı ve bootstrap.
- `REDIS_URL`, `REDIS_PASSWORD`: aynı güçlü parolayı içermeli.
- `AUTH_SECRET`: en az 32 karakter; `ENCRYPTION_KEY`: 64 hex karakter.
- `INITIAL_ADMIN_*`: idempotent seed ile ilk admin; gerçek ve benzersiz değerler.
- `SMTP_*`: production'da zorunlu e-posta transport ayarları.
- `GOOGLE_*`, `GITHUB_*`: OAuth uygulama kimlikleri; kullanılmıyorsa boş.
- `UPLOAD_STORAGE_DRIVER`: `local` veya `s3`; `UPLOAD_*`, `S3_*` limit/bağlantı.
- `NEXT_PUBLIC_DEFAULT_LOCALE`: varsayılan UI dili.
- `CERTBOT_EMAIL`: Let's Encrypt bildirim adresi.
- `NGINX_CLIENT_MAX_BODY_SIZE`, `NGINX_PROXY_READ_TIMEOUT`: proxy sınırları.
- `BACKUP_RETENTION_DAYS`, `BACKUP_ENCRYPTION_RECIPIENT`: yedek politikası.

Production `.env` için `chmod 600` kullanın. `docker compose config` secret
değerlerini ekrana açabilir; çıktısını ticket/log sistemlerine kopyalamayın.
Değişiklikten sonra `docker compose up -d --force-recreate` çalıştırın.

