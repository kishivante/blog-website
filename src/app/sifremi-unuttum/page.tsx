import { PageShell } from "@/components/page-shell";
import { AuthForm } from "@/components/auth-form";
import { createCsrfToken } from "@/server/csrf";
import { requestPasswordResetAction } from "@/server/actions/auth-actions";
export default async function Page() {
  return (
    <PageShell
      title="Şifremi unuttum"
      description="Sonuç, hesap varlığını açığa çıkarmadan e-posta ile bildirilir."
    >
      <AuthForm
        csrf={await createCsrfToken()}
        action={requestPasswordResetAction}
        submitLabel="Sıfırlama bağlantısı gönder"
        fields={[
          {
            name: "email",
            label: "E-posta",
            type: "email",
            autoComplete: "email",
          },
        ]}
      />
    </PageShell>
  );
}
