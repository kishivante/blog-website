import Image from "next/image";
import { PageShell } from "@/components/page-shell";
import { SettingsNav } from "@/components/settings-nav";
import { AuthForm } from "@/components/auth-form";
import { createCsrfToken } from "@/server/csrf";
import { requireUser } from "@/server/authorization";
import { beginTwoFactorSetup } from "@/services/two-factor-service";
import {
  disableTwoFactorAction,
  enableTwoFactorAction,
} from "@/server/actions/auth-actions";

export default async function Page() {
  const session = await requireUser();
  const enabled = Boolean(session.user.twoFactor?.enabledAt);
  const setup = enabled
    ? null
    : await beginTwoFactorSetup(session.userId, session.user.email);
  return (
    <PageShell
      title="Güvenlik ayarları"
      description="Parola, iki adımlı doğrulama ve hesap kurtarma seçenekleri."
    >
      <SettingsNav />
      <section className="settingsCard">
        <h2>İki adımlı doğrulama</h2>
        {enabled ? (
          <AuthForm
            csrf={await createCsrfToken()}
            action={disableTwoFactorAction}
            submitLabel="2FA’yı devre dışı bırak"
            fields={[
              {
                name: "password",
                label: "Mevcut parola",
                type: "password",
                autoComplete: "current-password",
              },
              {
                name: "code",
                label: "Doğrulama kodu",
                autoComplete: "one-time-code",
              },
            ]}
          />
        ) : setup ? (
          <>
            <p>
              QR kodunu uygulamanızla tarayın veya manuel anahtarı girin. Kod
              doğrulanmadan özellik etkinleşmez.
            </p>
            <Image
              src={setup.qrDataUrl}
              alt="İki adımlı doğrulama QR kodu"
              width={240}
              height={240}
              unoptimized
            />
            <p>
              <strong>Manuel anahtar:</strong> <code>{setup.secret}</code>
            </p>
            <AuthForm
              csrf={await createCsrfToken()}
              action={enableTwoFactorAction}
              submitLabel="2FA’yı etkinleştir"
              fields={[
                {
                  name: "code",
                  label: "Altı haneli kod",
                  autoComplete: "one-time-code",
                },
              ]}
            />
          </>
        ) : null}
      </section>
    </PageShell>
  );
}
