import { PageShell } from "@/components/page-shell";
import { SettingsNav } from "@/components/settings-nav";
import { SettingsForm } from "@/components/settings-form";
import { requireUser } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import {
  updateProfileAction,
  updateProfileImagesAction,
} from "@/server/actions/profile-actions";

export default async function Page() {
  const session = await requireUser();
  const csrf = await createCsrfToken();
  const user = session.user;
  return (
    <PageShell
      title="Profil ayarları"
      description="Profilinizde gösterilen bilgileri ve görselleri yönetin."
    >
      <SettingsNav />
      <div className="settingsGrid">
        <section className="settingsCard">
          <h2>Profil bilgileri</h2>
          <SettingsForm
            action={updateProfileAction}
            csrf={csrf}
            submitLabel="Profili kaydet"
          >
            <label>
              Görüntülenen ad
              <input
                name="displayName"
                defaultValue={user.displayName ?? ""}
                maxLength={80}
              />
            </label>
            <label>
              Biyografi
              <textarea
                name="biography"
                defaultValue={user.biography ?? ""}
                maxLength={500}
                rows={6}
              />
            </label>
            <label>
              Konum
              <input
                name="location"
                defaultValue={user.location ?? ""}
                maxLength={100}
              />
            </label>
            <label>
              Web sitesi
              <input
                name="website"
                type="url"
                defaultValue={user.website ?? ""}
                maxLength={300}
                placeholder="https://"
              />
            </label>
            <label>
              Dil
              <select name="locale" defaultValue={user.locale}>
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              Saat dilimi
              <select name="timezone" defaultValue={user.timezone}>
                <option value="Europe/Istanbul">Europe/Istanbul</option>
                <option value="UTC">UTC</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">America/New_York</option>
              </select>
            </label>
          </SettingsForm>
        </section>
        <section className="settingsCard">
          <h2>Profil görselleri</h2>
          <p>JPEG, PNG veya WebP. Avatar en fazla 3 MB, kapak en fazla 8 MB.</p>
          <SettingsForm
            action={updateProfileImagesAction}
            csrf={csrf}
            submitLabel="Görselleri yükle"
            encType="multipart/form-data"
          >
            <label>
              Avatar
              <input
                name="avatar"
                type="file"
                accept="image/jpeg,image/png,image/webp"
              />
            </label>
            <label>
              Kapak görseli
              <input
                name="cover"
                type="file"
                accept="image/jpeg,image/png,image/webp"
              />
            </label>
          </SettingsForm>
        </section>
      </div>
    </PageShell>
  );
}
