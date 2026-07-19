import Link from "next/link";

const items = [
  ["/ayarlar/profil", "Profil"],
  ["/ayarlar/hesap", "Hesap"],
  ["/ayarlar/guvenlik", "Güvenlik"],
  ["/ayarlar/gizlilik", "Gizlilik"],
  ["/ayarlar/bildirimler", "Bildirimler"],
  ["/ayarlar/bagli-hesaplar", "Bağlı hesaplar"],
  ["/ayarlar/gorunum", "Görünüm"],
] as const;

export function SettingsNav() {
  return (
    <nav className="settingsNav" aria-label="Ayarlar bölümleri">
      {items.map(([href, label]) => (
        <Link key={href} href={href}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
