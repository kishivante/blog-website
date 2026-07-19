import { PageShell } from "@/components/page-shell";
import { AuthForm } from "@/components/auth-form";
import { createCsrfToken } from "@/server/csrf";
import { registerAction } from "@/server/actions/auth-actions";

export default async function Page() {
  return (
    <PageShell
      title="Kayıt ol"
      description="Topluluğa katılmak için hesabınızı oluşturun."
    >
      <AuthForm
        csrf={await createCsrfToken()}
        action={registerAction}
        submitLabel="Hesap oluştur"
        fields={[
          {
            name: "username",
            label: "Kullanıcı adı",
            autoComplete: "username",
          },
          {
            name: "email",
            label: "E-posta",
            type: "email",
            autoComplete: "email",
          },
          {
            name: "password",
            label: "Parola",
            type: "password",
            autoComplete: "new-password",
          },
          {
            name: "passwordConfirm",
            label: "Parola tekrarı",
            type: "password",
            autoComplete: "new-password",
          },
        ]}
      >
        <label className="checkField">
          <input name="terms" type="checkbox" required /> Kullanım koşullarını
          ve gizlilik politikasını kabul ediyorum.
        </label>
      </AuthForm>
    </PageShell>
  );
}
