import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { SettingsNav } from "@/components/settings-nav";
import { AuthForm } from "@/components/auth-form";
import { requireUser } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { unlinkOAuthAction } from "@/server/actions/auth-actions";
import { db } from "@/server/db";

export default async function Page() {
  const session = await requireUser();
  const accounts = await db.oAuthAccount.findMany({
    where: { userId: session.userId },
    select: { provider: true, createdAt: true },
  });
  const linked = new Set(accounts.map((item) => item.provider));
  const csrf = await createCsrfToken();
  return (
    <PageShell
      title="Bağlı hesaplar"
      description="Google ve GitHub giriş yöntemlerinizi yönetin."
    >
      <SettingsNav />
      {(["google", "github"] as const).map((provider) => (
        <section className="settingsCard" key={provider}>
          <h2>{provider === "google" ? "Google" : "GitHub"}</h2>
          {linked.has(provider) ? (
            <AuthForm
              csrf={csrf}
              action={unlinkOAuthAction}
              submitLabel="Hesabı ayır"
              fields={[
                {
                  name: "provider",
                  label: "Sağlayıcı",
                  type: "hidden",
                  value: provider,
                },
              ]}
            />
          ) : (
            <Link
              className="buttonLink"
              href={{
                pathname: `/api/auth/oauth/${provider}`,
                query: { mode: "link" },
              }}
            >
              Hesabı bağla
            </Link>
          )}
        </section>
      ))}
    </PageShell>
  );
}
