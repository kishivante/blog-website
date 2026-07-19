import { PageShell } from "@/components/page-shell";
import { AuthForm } from "@/components/auth-form";
import { createCsrfToken } from "@/server/csrf";
import { verifyEmailAction } from "@/server/actions/auth-actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return (
    <PageShell title="E-posta doğrulama">
      <AuthForm
        csrf={await createCsrfToken()}
        action={verifyEmailAction}
        submitLabel="E-postamı doğrula"
        fields={[
          {
            name: "token",
            label: "Doğrulama anahtarı",
            type: "hidden",
            value: token,
          },
        ]}
      />
    </PageShell>
  );
}
