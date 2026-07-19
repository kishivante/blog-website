import { PageShell } from "@/components/page-shell";
import { AuthForm } from "@/components/auth-form";
import { createCsrfToken } from "@/server/csrf";
import { resetPasswordAction } from "@/server/actions/auth-actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return (
    <PageShell title="Şifre sıfırla">
      <AuthForm
        csrf={await createCsrfToken()}
        action={resetPasswordAction}
        submitLabel="Parolayı yenile"
        fields={[
          {
            name: "token",
            label: "Sıfırlama anahtarı",
            type: "hidden",
            value: token,
          },
          {
            name: "password",
            label: "Yeni parola",
            type: "password",
            autoComplete: "new-password",
          },
        ]}
      />
    </PageShell>
  );
}
