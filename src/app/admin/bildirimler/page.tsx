import { PageShell } from "@/components/page-shell";
import { SettingsForm } from "@/components/settings-form";
import { createAnnouncementAction } from "@/server/actions/admin-actions";
import { requirePermission } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";

export default async function NotificationsAdmin() {
  await requirePermission("settings.manage");
  const [roles, users, recent, csrf] = await Promise.all([
    db.role.findMany({ orderBy: { priority: "desc" } }),
    db.user.findMany({
      where: { accountStatus: "ACTIVE", deletedAt: null },
      orderBy: { username: "asc" },
      take: 500,
      select: { id: true, username: true },
    }),
    db.notification.findMany({
      where: { type: "SYSTEM" },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { sender: { select: { username: true } } },
    }),
    createCsrfToken(),
  ]);
  return (
    <PageShell
      title="Bildirim yönetimi"
      description="Uygulama içi ve isteğe bağlı e-posta duyuruları planlayın."
    >
      <SettingsForm
        action={createAnnouncementAction}
        csrf={csrf}
        submitLabel="Duyuruyu planla"
      >
        <label>
          Başlık
          <input name="title" minLength={3} maxLength={150} required />
        </label>
        <label>
          Mesaj
          <textarea name="message" minLength={5} maxLength={2000} required />
        </label>
        <label>
          Hedef
          <select name="target">
            <option value="all">Tüm kullanıcılar</option>
            <option value="roles">Belirli roller</option>
            <option value="users">Belirli kullanıcılar</option>
          </select>
        </label>
        <label>
          Roller
          <select name="roleIds" multiple>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kullanıcılar
          <select name="userIds" multiple>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                @{user.username}
              </option>
            ))}
          </select>
        </label>
        <label>
          Yayın zamanı
          <input type="datetime-local" name="scheduledAt" />
        </label>
        <label>
          <input type="checkbox" name="email" />
          E-posta kuyruğuna da ekle
        </label>
      </SettingsForm>
      <section className="settingsCard">
        <h2>Son sistem duyuruları</h2>
        {recent.map((item) => (
          <p key={item.id}>
            <strong>{item.title}</strong> ·{" "}
            {item.createdAt.toLocaleString("tr-TR")} · @
            {item.sender?.username ?? "sistem"} · {item.emailStatus}
          </p>
        ))}
      </section>
    </PageShell>
  );
}
