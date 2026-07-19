import { PageShell } from "@/components/page-shell";
import { SettingsForm } from "@/components/settings-form";
import { saveBadgeAction } from "@/server/actions/admin-actions";
import { requirePermission } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";

export default async function BadgesPage() {
  await requirePermission("badges.manage");
  const [badges, csrf] = await Promise.all([
    db.badge.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    createCsrfToken(),
  ]);
  const fields = (badge?: (typeof badges)[number]) => (
    <>
      <label>
        Kod
        <input
          name="code"
          defaultValue={badge?.code}
          pattern="[A-Z0-9_]+"
          required
        />
      </label>
      <label>
        Ad
        <input name="name" defaultValue={badge?.name} required />
      </label>
      <label>
        Açıklama
        <textarea name="description" defaultValue={badge?.description ?? ""} />
      </label>
      <label>
        Tür
        <select name="type" defaultValue={badge?.type ?? "CUSTOM"}>
          <option value="SYSTEM">Sistem</option>
          <option value="CUSTOM">Özel</option>
        </select>
      </label>
      <label>
        Renk
        <input
          name="color"
          type="color"
          defaultValue={badge?.color ?? "#3a8dde"}
        />
      </label>
      <label>
        İkon
        <input name="icon" defaultValue={badge?.icon ?? ""} />
      </label>
      <label>
        Sıra
        <input
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={badge?.sortOrder ?? 0}
        />
      </label>
      <label>
        <input
          name="visible"
          type="checkbox"
          defaultChecked={badge?.visible ?? true}
        />
        Görünür
      </label>
    </>
  );
  return (
    <PageShell title="Rozet yönetimi">
      <SettingsForm
        action={saveBadgeAction}
        csrf={csrf}
        submitLabel="Yeni rozet oluştur"
      >
        {fields()}
      </SettingsForm>
      <div className="adminTable">
        {badges.map((badge) => (
          <SettingsForm
            key={badge.id}
            action={saveBadgeAction}
            csrf={csrf}
            submitLabel="Güncelle"
          >
            <input type="hidden" name="id" value={badge.id} />
            {fields(badge)}
            <small>{badge._count.users} kullanıcı</small>
          </SettingsForm>
        ))}
      </div>
    </PageShell>
  );
}
