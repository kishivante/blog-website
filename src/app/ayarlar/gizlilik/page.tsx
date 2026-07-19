import { PageShell } from "@/components/page-shell";
import { SettingsNav } from "@/components/settings-nav";
import { SettingsForm } from "@/components/settings-form";
import { requireUser } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";
import { updatePrivacyAction } from "@/server/actions/profile-actions";
import { blockAction } from "@/server/actions/profile-actions";

export default async function Page() {
  const session = await requireUser();
  const privacy = await db.userPrivacySetting.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId },
    update: {},
  });
  const blocks = await db.userBlock.findMany({
    where: { blockerId: session.userId },
    include: {
      blocked: { select: { id: true, username: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const csrf = await createCsrfToken();
  return (
    <PageShell
      title="Gizlilik ayarları"
      description="Profil bilgilerinizin kimler tarafından görülebileceğini belirleyin. E-posta adresiniz hiçbir zaman herkese açık gösterilmez."
    >
      <SettingsNav />
      <section className="settingsCard">
        <SettingsForm
          action={updatePrivacyAction}
          csrf={csrf}
          submitLabel="Gizliliği kaydet"
        >
          <label>
            Profil görünürlüğü
            <select
              name="profileVisibility"
              defaultValue={
                session.user.profileVisibility === "FOLLOWERS"
                  ? "AUTHENTICATED"
                  : session.user.profileVisibility
              }
            >
              <option value="PUBLIC">Herkese açık</option>
              <option value="AUTHENTICATED">Yalnızca giriş yapanlar</option>
              <option value="PRIVATE">Gizli</option>
            </select>
          </label>
          <label className="checkRow">
            <input
              type="checkbox"
              name="showFollowers"
              defaultChecked={privacy.showFollowers}
            />{" "}
            Takipçi listesini göster
          </label>
          <label className="checkRow">
            <input
              type="checkbox"
              name="showFollowing"
              defaultChecked={privacy.showFollowing}
            />{" "}
            Takip edilenleri göster
          </label>
          <label className="checkRow">
            <input
              type="checkbox"
              name="showCommentHistory"
              defaultChecked={privacy.showCommentHistory}
            />{" "}
            Yorum geçmişini göster
          </label>
          <label className="checkRow">
            <input
              type="checkbox"
              name="showWikiContributions"
              defaultChecked={privacy.showWikiContributions}
            />{" "}
            Wiki katkılarını göster
          </label>
          <label className="checkRow">
            <input
              type="checkbox"
              name="showOnlineStatus"
              defaultChecked={privacy.showOnlineStatus}
            />{" "}
            Çevrimiçi durumunu göster
          </label>
        </SettingsForm>
      </section>
      <section className="settingsCard">
        <h2>Engellenen kullanıcılar</h2>
        {blocks.length ? (
          <ul className="settingsList">
            {blocks.map(({ blocked }) => (
              <li key={blocked.id}>
                <span>
                  {blocked.displayName ?? blocked.username} · @
                  {blocked.username}
                </span>
                <form action={blockAction}>
                  <input type="hidden" name="_csrf" value={csrf} />
                  <input type="hidden" name="targetId" value={blocked.id} />
                  <input type="hidden" name="path" value="/ayarlar/gizlilik" />
                  <input type="hidden" name="intent" value="unblock" />
                  <button className="quietButton">Engeli kaldır</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p>Engellenen kullanıcı yok.</p>
        )}
      </section>
    </PageShell>
  );
}
