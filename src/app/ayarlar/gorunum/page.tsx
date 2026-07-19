import { PageShell } from "@/components/page-shell";
import { SettingsNav } from "@/components/settings-nav";
import { SettingsForm } from "@/components/settings-form";
import { requireUser } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { updateAppearanceAction } from "@/server/actions/profile-actions";

export default async function Page() {
  const session = await requireUser();
  const settings = session.user.profileLayoutSettings as {
    layout?: string;
  } | null;
  return (
    <PageShell
      title="Profil görünümü"
      description="Güvenli, sınırlı profil görünüm seçenekleri. Özel CSS veya JavaScript kabul edilmez."
    >
      <SettingsNav />
      <section className="settingsCard">
        <SettingsForm
          action={updateAppearanceAction}
          csrf={await createCsrfToken()}
          submitLabel="Görünümü kaydet"
        >
          <label>
            Vurgu rengi
            <input
              name="profileAccent"
              type="color"
              defaultValue={session.user.profileAccent ?? "#ef4056"}
            />
          </label>
          <label>
            Profil düzeni
            <select name="layout" defaultValue={settings?.layout ?? "STANDARD"}>
              <option value="STANDARD">Standart</option>
              <option value="COMPACT">Kompakt</option>
              <option value="EDITORIAL">Editoryal</option>
            </select>
          </label>
        </SettingsForm>
      </section>
    </PageShell>
  );
}
