import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { AuthForm } from "@/components/auth-form";
import { createCsrfToken } from "@/server/csrf";
import { loginAction } from "@/server/actions/auth-actions";

export default async function Page() {
  return (
    <PageShell
      title="Giriş yap"
      description="Hesabınıza güvenli biçimde erişin."
    >
      <AuthForm
        csrf={await createCsrfToken()}
        action={loginAction}
        submitLabel="Giriş yap"
        fields={[
          {
            name: "identity",
            label: "E-posta veya kullanıcı adı",
            autoComplete: "username",
          },
          {
            name: "password",
            label: "Parola",
            type: "password",
            autoComplete: "current-password",
          },
        ]}
      />
      <div className="oauthLinks">
        <Link
          className="buttonLink"
          href={{ pathname: "/api/auth/oauth/google" }}
        >
          Google ile devam et
        </Link>
        <Link
          className="buttonLink"
          href={{ pathname: "/api/auth/oauth/github" }}
        >
          GitHub ile devam et
        </Link>
      </div>
      <p>
        <Link href="/sifremi-unuttum">Parolamı unuttum</Link>
      </p>
    </PageShell>
  );
}
