import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { PostCard, WikiCard } from "@/components/content-cards";
import { EmptyState } from "@/components/ui/primitives";
import { searchQuerySchema } from "@/validators/search";
import { db } from "@/server/db";
import { enforceRateLimit } from "@/server/rate-limit";
import { getRequestContext } from "@/server/request-context";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = searchQuerySchema.parse(await searchParams);
  if (q.length < 2) {
    return (
      <PageShell title="Ara" description="Haber, Wiki ve kullanıcı profillerinde arama yapın.">
        <EmptyState title="Arama terimi girin" description="Arama kutusuna en az iki karakter yazın." />
      </PageShell>
    );
  }
  const context = await getRequestContext();
  await enforceRateLimit("search", context.ip);
  const [posts, wiki, users] = await Promise.all([
    db.post.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        publishedAt: { lte: new Date() },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { excerpt: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: 12,
      include: {
        author: { include: { roles: { include: { role: true } } } },
        categories: { include: { category: true } },
      },
    }),
    db.wikiPage.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
          { renderedContent: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
      include: { lastEditor: { select: { username: true, displayName: true } } },
    }),
    db.user.findMany({
      where: {
        accountStatus: "ACTIVE",
        deletedAt: null,
        profileVisibility: "PUBLIC",
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { displayName: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { followerCount: "desc" },
      take: 10,
      select: { username: true, displayName: true, biography: true },
    }),
  ]);
  const empty = !posts.length && !wiki.length && !users.length;
  return (
    <PageShell title="Ara" description={`“${q}” için sonuçlar`}>
      {empty ? <EmptyState title="Sonuç bulunamadı" description="Daha genel bir arama terimi deneyin." /> : null}
      {posts.length ? <section><h2>Haberler</h2><div className="postGridNew">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div></section> : null}
      {wiki.length ? <section><h2>Wiki</h2><div className="wikiGrid">{wiki.map((item) => <WikiCard key={item.id} title={item.title} slug={item.slug} summary={item.summary} editor={item.lastEditor.displayName ?? item.lastEditor.username} updatedAt={item.updatedAt} />)}</div></section> : null}
      {users.length ? <section><h2>Kullanıcılar</h2><div className="adminTable">{users.map((user) => <article className="adminTableRow" key={user.username}><Link href={`/kullanici/${user.username}`}><strong>{user.displayName ?? user.username}</strong> <small>@{user.username}</small></Link>{user.biography ? <p>{user.biography}</p> : null}</article>)}</div></section> : null}
    </PageShell>
  );
}
