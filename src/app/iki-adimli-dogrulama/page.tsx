import { PageShell } from "@/components/page-shell";
import { AuthForm } from "@/components/auth-form";
import { createCsrfToken } from "@/server/csrf";
import { completeTwoFactorAction } from "@/server/actions/auth-actions";
export default async function Page() {
  return (
    <PageShell
      title="İki adımlı doğrulama"
      description="Kimlik doğrulama uygulamanızdaki kodu veya kurtarma kodunuzu girin."
    >
      <AuthForm
        csrf={await createCsrfToken()}
        action={completeTwoFactorAction}
        submitLabel="Doğrula"
        fields={[
          {
            name: "code",
            label: "Doğrulama kodu",
            autoComplete: "one-time-code",
          },
        ]}
      >
        <label className="checkField">
          <input name="trustDevice" type="checkbox" /> Bu cihaza 30 gün güven
        </label>
      </AuthForm>
    </PageShell>
  );
}
