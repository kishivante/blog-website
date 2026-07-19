# Güvenlik

- İnternete yalnız Nginx 80/443 açılır; PostgreSQL, Redis, app ve worker internal
  ağdadır.
- App/worker non-root, read-only root filesystem, dropped capabilities ve
  `no-new-privileges` ile çalışır.
- Redis parola ister ve AOF kullanır. PostgreSQL/Redis parolaları farklı olmalı.
- Session cookie HttpOnly, Secure (production), SameSite=Lax ve `__Host-`
  öneklidir. Hassas mutation'larda origin bağlı CSRF doğrulaması vardır.
- Yetki route, server action ve API seviyesinde permission tabanlıdır.
- Upload magic-byte doğrulama, yeniden encode, piksel/boyut sınırı, rastgele key,
  path confinement ve güvenli response header'ları uygular.
- Nginx dotfile, env, Git, source map, backup ve çalıştırılabilir upload
  uzantılarını engeller; TLS/HSTS/nosniff/frame/referrer/permissions başlıkları
  uygular.
- Uygulama loglarına parola, token, cookie, secret veya tam OAuth response'u
  yazılmamalıdır. Docker logları boyut/dosya sayısıyla döndürülür.
- Admin ve kişisel sayfalar `no-store`; taslaklar sitemap/RSS dışında ve noindex
  olmalıdır.

## Proxy güven modeli

Nginx yalnız Docker frontend ağından uygulamaya `X-Real-IP` aktarır. Uygulama
`TRUSTED_HOSTS` kontrolü yapar. Cloudflare etkinleştirilirse yalnız resmi
Cloudflare CIDR'ları trusted proxy yapılmalıdır; herkese açık proxy
başlıklarına güvenmek IP rate limit bypass'ına yol açar.

## Olay yönetimi

Şüpheli durumda erişim anahtarlarını döndürün, aktif session'ları iptal edin,
audit/security event kayıtlarını ve sınırlı Docker loglarını inceleyin, temiz
yedekten kurtarma gereksinimini değerlendirin. `.env`, veritabanı dump'ı ve
upload yedekleri hassas kabul edilir. Güvenlik güncellemeleri için
`UPGRADE.md` akışını izleyin.

