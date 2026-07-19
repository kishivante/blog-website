import type { ReactNode } from "react";
import Link from "next/link";
import { requirePermission } from "@/server/authorization";

const links = [
  ["/admin", "Genel bakış", "admin.access"],
  ["/admin/yazilar", "Yazılar", "posts.review"],
  ["/admin/kullanicilar", "Kullanıcılar", "users.manage"],
  ["/admin/yorumlar", "Yorumlar", "comments.moderate"],
  ["/admin/raporlar", "Raporlar", "reports.manage"],
  ["/admin/kategoriler", "Kategoriler", "taxonomy.manage"],
  ["/admin/etiketler", "Etiketler", "taxonomy.manage"],
  ["/admin/wiki", "Wiki", "wiki.edit"],
  ["/admin/roller", "Roller", "roles.manage"],
  ["/admin/rozetler", "Rozetler", "badges.manage"],
  ["/admin/bildirimler", "Bildirimler", "settings.manage"],
  ["/admin/tema", "Tema", "settings.manage"],
  ["/admin/site-ayarlari", "Site ayarları", "settings.manage"],
  ["/admin/guvenlik", "Güvenlik", "security.manage"],
  ["/admin/denetim-kayitlari", "Denetim", "audit.read"],
  ["/admin/sistem", "Sistem", "settings.manage"],
] as const;

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requirePermission("admin.access");
  const permissions = new Set(
    session.user.roles.flatMap(({ role }) =>
      role.permissions.map(({ permission }) => permission.key),
    ),
  );
  return (
    <div className="adminFrame">
      <aside className="adminSidebar">
        <strong>Yönetim paneli</strong>
        <nav aria-label="Yönetim navigasyonu">
          {links
            .filter(([, , permission]) => permissions.has(permission))
            .map(([href, label]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
        </nav>
      </aside>
      <div className="adminMain">{children}</div>
    </div>
  );
}
