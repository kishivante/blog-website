import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { WikiCard } from "@/components/content-cards";
import { EmptyState } from "@/components/ui/primitives";
import { listPublishedWiki } from "@/repositories/wiki-repository";
import { wikiSearchSchema } from "@/validators/wiki";

export const metadata: Metadata = {
  title: "Wiki",
  description:
    "Scarlet Satellite kullanım, hesap güvenliği ve platform özellikleri bilgi bankası.",
};

export default async function WikiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = wikiSearchSchema.parse({
    q: typeof raw.q === "string" ? raw.q : "",
    page: typeof raw.page === "string" ? raw.page : 1,
  });
  const result = await listPublishedWiki(parsed.q, parsed.page);
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  return (
    <PageShell
      title="Wiki"
      description="Platformu güvenli ve verimli kullanmak için güncel bilgi bankası."
    >
      <form className="wikiSearch" action="/wiki">
        <label htmlFor="wiki-query">Wiki içinde ara</label>
        <div>
          <input
            id="wiki-query"
            name="q"
            defaultValue={parsed.q}
            maxLength={120}
            placeholder="Başlık, içerik, kategori veya etiket"
          />
          <button className="uiButton">Ara</button>
        </div>
      </form>
      {result.items.length ? (
        <>
          <div className="wikiList">
            {result.items.map((item) => (
              <WikiCard
                key={item.id}
                title={item.title}
                slug={item.slug}
                summary={item.summary}
                editor={item.lastEditor.displayName ?? item.lastEditor.username}
                updatedAt={item.updatedAt}
              />
            ))}
          </div>
          <nav className="pagination" aria-label="Sayfalama">
            <Link
              aria-disabled={parsed.page <= 1}
              href={{
                pathname: "/wiki",
                query: {
                  q: parsed.q || undefined,
                  page: Math.max(1, parsed.page - 1),
                },
              }}
            >
              Önceki
            </Link>
            <span>
              {parsed.page} / {pageCount}
            </span>
            <Link
              aria-disabled={parsed.page >= pageCount}
              href={{
                pathname: "/wiki",
                query: {
                  q: parsed.q || undefined,
                  page: Math.min(pageCount, parsed.page + 1),
                },
              }}
            >
              Sonraki
            </Link>
          </nav>
        </>
      ) : (
        <EmptyState
          title="Wiki sonucu bulunamadı"
          description={
            parsed.q
              ? "Arama ifadenizi değiştirerek yeniden deneyin."
              : "Henüz yayınlanmış bir Wiki sayfası bulunmuyor."
          }
        />
      )}
      {parsed.q ? (
        <p>
          <Link href="/wiki">Tüm Wiki sayfalarını göster</Link>
        </p>
      ) : null}
    </PageShell>
  );
}
