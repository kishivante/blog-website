# Üretime Alma

## 1. DNS ve Linux

DNS sağlayıcısında `blog.scarletsatellite.com` için `178.208.187.67` adresine
bir A kaydı oluşturun. Bunlar yalnızca kurulum örneğidir; uygulama kodunda
sabitlenmemiştir. DNS yayıldıktan sonra Ubuntu/Debian tabanlı güncel bir Linux
sunucuda 80 ve 443/TCP portlarını açın. SSH erişimini anahtar tabanlı tutun.

Docker Engine ve Compose eklentisini Docker'ın resmi Linux kurulum
belgelerinden kurun: https://docs.docker.com/engine/install/

## 2. Ortam ve sırlar

```sh
cp .env.example .env
chmod 600 .env
openssl rand -base64 48   # AUTH_SECRET ve güçlü parolalar
openssl rand -hex 32      # ENCRYPTION_KEY
```

`.env` içinde `APP_DOMAIN`, HTTPS `APP_URL`, aynı domaini içeren
`TRUSTED_HOSTS`, birbirinden farklı PostgreSQL/Redis parolaları, SMTP ve ilk
admin bilgilerini girin. İlk admin parolasını ilk girişten sonra değiştirin.
`.env` dosyasını image'a kopyalamayın veya sürüm kontrolüne eklemeyin.

## 3. Build ve başlangıç

```sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml config
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose ps
```

Nginx sertifika yokken ACME HTTP challenge sunar. Certbot ilk sertifikayı
otomatik alır; Nginx en geç beş dakika içinde HTTPS yapılandırmasına geçer.
Certbot 12 saatte bir yenilemeyi kontrol eder, Nginx sertifikayı yeniden yükler.

```sh
docker compose logs -f certbot nginx
curl -I http://"$APP_DOMAIN"
curl -fsS https://"$APP_DOMAIN"/health
```

Migration/seed app başlangıcında güvenli ve idempotent çalışır. Durum:

```sh
docker compose exec app ./node_modules/.bin/prisma migrate status
docker compose logs --tail=200 app
```

## 4. Operasyon

```sh
docker compose ps
docker compose logs -f --tail=200 app worker nginx
docker compose restart app worker
```

PostgreSQL ve Redis host portu yayınlamaz. Uygulama portu da yalnızca internal
Docker ağındadır; internete sadece Nginx açıktır.

## 5. Domain, SMTP ve OAuth değişikliği

Domain değişiminde `APP_DOMAIN`, `APP_URL`, `TRUSTED_HOSTS` ve `CERTBOT_EMAIL`
değerlerini düzenleyin; OAuth sağlayıcılarında callback'leri
`https://YENI_DOMAIN/api/auth/oauth/google/callback` ve
`https://YENI_DOMAIN/api/auth/oauth/github/callback` olarak güncelleyin.
Eski Let's Encrypt volume'unu silmeden yeni sertifika alın ve servisleri
yeniden oluşturun. SMTP değişimi yalnız `.env` içindeki `SMTP_*` değerleriyle
yapılır.

## 6. Cloudflare

Cloudflare zorunlu değildir. Proxy açılırsa SSL modu **Full (strict)** olmalı.
Origin 80/443 yalnız Cloudflare IP aralıklarına firewall ile sınırlandırılabilir.
Gerçek IP için Nginx'e yalnız Cloudflare'ın resmi, güncel CIDR listeleri
`set_real_ip_from` olarak eklenmeli ve `real_ip_header CF-Connecting-IP`
kullanılmalıdır. İnternetten gelen keyfi `X-Forwarded-For` başlığına güvenmeyin.
Cloudflare CIDR listesini periyodik güncelleyin.

## 7. S3'e geçiş

Önce mevcut upload yedeğini alın. `UPLOAD_STORAGE_DRIVER=s3`, endpoint, region,
bucket, access key/secret, path-style ve private bucket ayarlarını doldurun.
MinIO için çoğunlukla path-style gerekir. Mevcut yerel nesneleri aynı storage
key'leriyle S3'e aktarın, örnek yükleme/indirme/signed URL testinden sonra app
ve worker'ı yeniden oluşturun. Secret'ları admin paneline girmeyin.

