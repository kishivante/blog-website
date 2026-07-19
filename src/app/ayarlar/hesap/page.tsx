import { PageShell } from "@/components/page-shell";
import { SettingsNav } from "@/components/settings-nav";
import { SettingsForm } from "@/components/settings-form";
import { AuthForm } from "@/components/auth-form";
import { createCsrfToken } from "@/server/csrf";
import { requireUser } from "@/server/authorization";
import {
  revokeOtherSessionsAction,
  revokeTrustedDeviceAction,
} from "@/server/actions/auth-actions";
import {
  changePasswordAction,
  changeUsernameAction,
  confirmEmailChangeAction,
  deactivateAccountAction,
  requestDeletionAction,
  requestEmailChangeAction,
} from "@/server/actions/profile-actions";
import { db } from "@/server/db";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ emailToken?: string }>;
}) {
  const session = await requireUser({ verified: false });
  const { emailToken } = await searchParams;
  const [sessions, trustedDevices, loginHistory] = await Promise.all([
    db.session.findMany({
      where: {
        userId: session.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: "desc" },
      select: { id: true, ipAddress: true, userAgent: true, lastUsedAt: true },
    }),
    db.trustedDevice.findMany({
      where: {
        userId: session.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: "desc" },
    }),
    db.loginAttempt.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  const csrf = await createCsrfToken();
  return (
    <PageShell
      title="Hesap ayarları"
      description="Kimlik bilgilerinizi, oturumlarınızı ve hesap yaşam döngüsünü yönetin."
    >
      <SettingsNav />
      {emailToken ? (
        <section className="settingsCard">
          <h2>E-posta onayı</h2>
          <SettingsForm
            action={confirmEmailChangeAction}
            csrf={csrf}
            submitLabel="Bu adresi onayla"
          >
            <input type="hidden" name="token" value={emailToken} />
          </SettingsForm>
        </section>
      ) : null}
      <div className="settingsGrid">
        <section className="settingsCard">
          <h2>Kullanıcı adını değiştir</h2>
          <p>
            Eski kullanıcı adınız profilinize yönlendirme için saklanır. Korunan
            ve yanıltıcı adlar kullanılamaz.
          </p>
          <SettingsForm
            action={changeUsernameAction}
            csrf={csrf}
            submitLabel="Kullanıcı adını değiştir"
          >
            <label>
              Yeni kullanıcı adı
              <input
                name="username"
                defaultValue={session.user.username}
                minLength={3}
                maxLength={32}
              />
            </label>
            <label>
              Mevcut parola
              <input
                name="password"
                type="password"
                autoComplete="current-password"
              />
            </label>
          </SettingsForm>
        </section>
        <section className="settingsCard">
          <h2>E-posta adresini değiştir</h2>
          <p>
            Değişiklik hem mevcut hem yeni adrese gönderilen bağlantılar
            onaylanınca tamamlanır.
          </p>
          <SettingsForm
            action={requestEmailChangeAction}
            csrf={csrf}
            submitLabel="Onay bağlantılarını gönder"
          >
            <label>
              Yeni e-posta
              <input name="email" type="email" autoComplete="email" />
            </label>
            <label>
              Mevcut parola
              <input
                name="password"
                type="password"
                autoComplete="current-password"
              />
            </label>
          </SettingsForm>
        </section>
        <section className="settingsCard">
          <h2>Parolayı değiştir</h2>
          <SettingsForm
            action={changePasswordAction}
            csrf={csrf}
            submitLabel="Parolayı değiştir"
          >
            <label>
              Mevcut parola
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
              />
            </label>
            <label>
              Yeni parola
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
              />
            </label>
            <label>
              Yeni parola tekrarı
              <input
                name="newPasswordConfirm"
                type="password"
                autoComplete="new-password"
                minLength={12}
              />
            </label>
            <label className="checkRow">
              <input name="revokeOthers" type="checkbox" defaultChecked /> Diğer
              oturumları kapat
            </label>
          </SettingsForm>
        </section>
      </div>
      <section className="settingsCard">
        <h2>Aktif oturumlar</h2>
        <ul className="settingsList">
          {sessions.map((item) => (
            <li key={item.id}>
              <strong>
                {item.id === session.id ? "Bu oturum" : "Diğer oturum"}
              </strong>
              <span>
                {item.ipAddress ?? "IP bilinmiyor"} ·{" "}
                {item.lastUsedAt.toLocaleString("tr-TR")}
              </span>
              <small>{item.userAgent ?? "Tarayıcı bilgisi yok"}</small>
            </li>
          ))}
        </ul>
        <AuthForm
          csrf={csrf}
          action={revokeOtherSessionsAction}
          submitLabel="Diğer tüm oturumları kapat"
          fields={[]}
        />
      </section>
      <section className="settingsCard">
        <h2>Güvenilir cihazlar</h2>
        {trustedDevices.length ? (
          trustedDevices.map((device) => (
            <div className="deviceRow" key={device.id}>
              <p>
                {device.name ?? "Adsız cihaz"} ·{" "}
                {device.lastUsedAt.toLocaleString("tr-TR")}
              </p>
              <AuthForm
                csrf={csrf}
                action={revokeTrustedDeviceAction}
                submitLabel="Cihazı kaldır"
                fields={[
                  {
                    name: "deviceId",
                    label: "Cihaz",
                    type: "hidden",
                    value: device.id,
                  },
                ]}
              />
            </div>
          ))
        ) : (
          <p>Kayıtlı güvenilir cihaz yok.</p>
        )}
      </section>
      <section className="settingsCard">
        <h2>Son giriş geçmişi</h2>
        <ul className="settingsList">
          {loginHistory.map((attempt) => (
            <li key={attempt.id}>
              <strong>{attempt.successful ? "Başarılı" : "Başarısız"}</strong>
              <span>
                {attempt.ipAddress} ·{" "}
                {attempt.createdAt.toLocaleString("tr-TR")}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="settingsCard dangerZone">
        <h2>Hesap işlemleri</h2>
        <p>
          Devre dışı bırakma anında oturumlarınızı kapatır. Silme talebi 14
          günlük bekleme süresinden sonra işlenir.
        </p>
        <div className="settingsGrid">
          <SettingsForm
            action={deactivateAccountAction}
            csrf={csrf}
            submitLabel="Hesabı devre dışı bırak"
          >
            <label>
              Parola
              <input name="password" type="password" />
            </label>
            <label>
              2FA kodu (etkinse)
              <input name="totp" inputMode="numeric" />
            </label>
          </SettingsForm>
          <SettingsForm
            action={requestDeletionAction}
            csrf={csrf}
            submitLabel="Silme talebi oluştur"
          >
            <label>
              Parola
              <input name="password" type="password" />
            </label>
            <label>
              2FA kodu (etkinse)
              <input name="totp" inputMode="numeric" />
            </label>
          </SettingsForm>
        </div>
      </section>
    </PageShell>
  );
}
