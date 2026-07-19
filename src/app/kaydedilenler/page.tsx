import { PageShell } from "@/components/page-shell";
import { PostCard } from "@/components/content-cards";
import { EmptyState } from "@/components/ui/primitives";
import { requireUser } from "@/server/authorization";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireUser();
  const bookmarks = await db.postBookmark.findMany({
    where: {
      userId: session.userId,
      post: { status: "PUBLISHED", deletedAt: null, publishedAt: { lte: new Date() } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      post: {
        include: {
          author: { include: { roles: { include: { role: true } } } },
          categories: { include: { category: true } },
        },
      },
    },
  });
  return (
    <PageShell title="Kaydedilenler" description="Daha sonra okumak için kaydettiğiniz yayınlar.">
      {bookmarks.length ? (
        <div className="postGridNew">
          {bookmarks.map(({ post }) => <PostCard key={post.id} post={post} />)}
        </div>
      ) : (
        <EmptyState title="Kaydedilmiş yazı yok" description="Bir yayındaki kaydet düğmesini kullanarak okuma listenizi oluşturabilirsiniz." />
      )}
    </PageShell>
  );
}
