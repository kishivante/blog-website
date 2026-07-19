import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { PostCard } from "@/components/content-cards";
import { EmptyState, Pagination, Select } from "@/components/ui/primitives";
import { postRepository } from "@/repositories/post-repository";
import { db } from "@/server/db";
import { getSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    category?: string;
    tag?: string;
    sort?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const sort = params.sort === "oldest" ? "oldest" : "newest";
  const view = ["topics", "editors", "popular", "following"].includes(
    params.view ?? "",
  )
    ? (params.view as "topics" | "editors" | "popular" | "following")
    : "latest";
  const session = view === "following" ? await getSession() : null;
  const [{ items, hasNext }, categories, tags] = await Promise.all([
    postRepository.listPublishedPage({
      page,
      query: params.q?.trim(),
      category: params.category,
      tag: params.tag,
      sort,
      view,
      viewerId: session?.userId,
    }),
    db.category.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { name: true, slug: true },
    }),
    db.tag.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      take: 30,
      select: { name: true, slug: true },
    }),
  ]);
  return (
    <PageShell
      title="Son Haberler"
      description="Editoryal süzgeçten geçmiş teknoloji, bilim ve kültür yayınları."
    >
      <nav className="contentTabs" aria-label="Haber görünümleri">
        <Link aria-current={view === "latest" ? "page" : undefined} href="/haberler">
          Son Haberler
        </Link>
        <Link aria-current={view === "topics" ? "page" : undefined} href={{ pathname: "/haberler", query: { view: "topics" } }}>
          Son Konular
        </Link>
        <Link aria-current={view === "editors" ? "page" : undefined} href={{ pathname: "/haberler", query: { view: "editors" } }}>
          Editörün Seçtikleri
        </Link>
        <Link aria-current={view === "popular" ? "page" : undefined} href={{ pathname: "/haberler", query: { view: "popular" } }}>
          Popüler
        </Link>
        <Link aria-current={view === "following" ? "page" : undefined} href={{ pathname: "/haberler", query: { view: "following" } }}>
          Takip Edilenlerden
        </Link>
      </nav>
      <form className="filterBar" action="/haberler">
        {view !== "latest" ? <input type="hidden" name="view" value={view} /> : null}
        <label>
          <span className="srOnly">Ara</span>
          <input
            className="uiInput"
            name="q"
            defaultValue={params.q}
            placeholder="Haberlerde ara"
          />
        </label>
        <Select
          name="category"
          defaultValue={params.category ?? ""}
          aria-label="Kategori"
        >
          <option value="">Tüm kategoriler</option>
          {categories.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select name="tag" defaultValue={params.tag ?? ""} aria-label="Etiket">
          <option value="">Tüm etiketler</option>
          {tags.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select name="sort" defaultValue={sort} aria-label="Tarih sıralaması">
          <option value="newest">En yeni</option>
          <option value="oldest">En eski</option>
        </Select>
        <button className="uiButton" type="submit">
          Uygula
        </button>
      </form>
      {items.length ? (
        <div className="postGridNew">
          {items.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={view === "following" && !session ? "Giriş yapmanız gerekiyor" : "Eşleşen haber yok"}
          description={view === "following" && !session ? "Takip ettiğiniz yazarların yayınlarını görmek için giriş yapın." : "Filtreleri değiştirerek yeniden deneyin."}
        />
      )}
      <Pagination
        page={page}
        hasNext={hasNext}
        basePath="/haberler"
        query={{
          q: params.q,
          category: params.category,
          tag: params.tag,
          sort,
          view: view === "latest" ? undefined : view,
        }}
      />
    </PageShell>
  );
}
