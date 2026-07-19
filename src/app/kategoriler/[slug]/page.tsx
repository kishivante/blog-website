import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { PostCard } from "@/components/content-cards";
import { EmptyState, Pagination } from "@/components/ui/primitives";
import { db } from "@/server/db";
import { postRepository } from "@/repositories/post-repository";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);
  const category = await db.category.findFirst({ where: { slug, active: true } });
  if (!category) notFound();
  const result = await postRepository.listPublishedPage({ page, category: slug, sort: "newest" });
  return (
    <PageShell title={category.name} description={category.description ?? "Bu kategorideki yayınlar."}>
      {result.items.length ? <div className="postGridNew">{result.items.map((post) => <PostCard key={post.id} post={post} />)}</div> : <EmptyState title="Yayın bulunmuyor" description="Bu kategoride henüz yayınlanmış içerik yok." />}
      <Pagination page={page} hasNext={result.hasNext} basePath={`/kategoriler/${slug}`} />
    </PageShell>
  );
}
