import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { PostCard } from "@/components/content-cards";
import { EmptyState } from "@/components/ui/primitives";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const series = await db.series.findUnique({
    where: { slug },
    include: {
      posts: {
        where: { status: "PUBLISHED", deletedAt: null },
        orderBy: [{ seriesOrder: "asc" }, { publishedAt: "asc" }],
        include: {
          author: { include: { roles: { include: { role: true } } } },
          categories: { include: { category: true } },
        },
      },
    },
  });
  if (!series || !series.active) notFound();
  return (
    <PageShell
      title={series.name}
      description={series.description ?? undefined}
    >
      {series.posts.length ? (
        <div className="postGridNew">
          {series.posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Bu seride yayın yok"
          description="Yayınlanan bölümler burada sıralanacak."
        />
      )}
    </PageShell>
  );
}
