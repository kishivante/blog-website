import { PageShell } from "@/components/page-shell";
import { AdminThemeForm } from "@/components/admin-theme-form";
import { saveThemeAction } from "@/server/actions/admin-actions";
import { requirePermission } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";
export default async function ThemePage() {
  await requirePermission("settings.manage");
  const [theme, csrf] = await Promise.all([
    db.themeSetting.findUnique({ where: { id: "default" } }),
    createCsrfToken(),
  ]);
  if (!theme) throw new Error("Tema ayarları bulunamadı.");
  return (
    <PageShell
      title="Tema yönetimi"
      description="Doğrulanmış tema değerleri CSS custom property olarak tüm uygulamaya uygulanır."
    >
      <AdminThemeForm action={saveThemeAction} csrf={csrf} theme={theme} />
    </PageShell>
  );
}
