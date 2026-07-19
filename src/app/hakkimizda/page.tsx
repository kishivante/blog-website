import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/primitives";
export default function Page() {
  return (
    <PageShell
      title="Hakkımızda"
      description="Scarlet Satellite; teknoloji, bilim ve kültürün kesişimini bağımsız, kaynak odaklı bir yayın anlayışıyla ele alır."
    >
      <Card>
        <h2>Yayın yaklaşımımız</h2>
        <p>
          Okura saygı duyan, sakin ve anlaşılır içerikler üretir; önemli
          değişiklikleri revizyon geçmişinde koruruz.
        </p>
      </Card>
    </PageShell>
  );
}
