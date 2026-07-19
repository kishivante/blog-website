import { PageShell } from "@/components/page-shell";
import { SettingsNav } from "@/components/settings-nav";
import { SettingsForm } from "@/components/settings-form";
import { requireUser } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";
import { updateNotificationsAction } from "@/server/actions/profile-actions";

export default async function Page() {
  const session = await requireUser();
  const value = await db.userNotificationSetting.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId },
    update: {},
  });
  const options = [
    ["emailEnabled", "E-posta bildirimleri"],
    ["securityEmail", "Güvenlik e-postaları"],
    ["commentNotifications", "Yorum bildirimleri"],
    ["replyNotifications", "Yanıt bildirimleri"],
    ["followerNotifications", "Yeni takipçi bildirimleri"],
    ["reviewNotifications", "İnceleme bildirimleri"],
    ["marketingEmail", "Duyuru e-postaları"],
  ] as const;
  return (
    <PageShell
      title="Bildirim ayarları"
      description="Hangi olaylarda uygulama veya e-posta bildirimi alacağınızı belirleyin."
    >
      <SettingsNav />
      <section className="settingsCard">
        <SettingsForm
          action={updateNotificationsAction}
          csrf={await createCsrfToken()}
          submitLabel="Bildirimleri kaydet"
        >
          {options.map(([name, label]) => (
            <label className="checkRow" key={name}>
              <input type="checkbox" name={name} defaultChecked={value[name]} />{" "}
              {label}
            </label>
          ))}
        </SettingsForm>
      </section>
    </PageShell>
  );
}
