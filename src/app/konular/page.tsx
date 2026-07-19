import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/ui/primitives";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const series = await db.series.findMany({
    where: { active: true },
    include: {
      _count: {
        select: { posts: { where: { status: "PUBLISHED", deletedAt: null } } },
      },
    },
    orderBy: { name: "asc" },
  });
  return (
    <PageShell
      title="Konular ve seriler"
      description="Birbiriyle bağlantılı yayın dizilerini keşfedin."
    >
      {series.length ? (
        <div className="topicSeriesGrid">
          {series.map((item) => (
            <Link
              className="settingsCard"
              href={`/konular/${item.slug}`}
              key={item.id}
              style={
                {
                  "--series-color": item.color ?? "var(--color-azure)",
                } as React.CSSProperties
              }
            >
              <span>{item._count.posts} bölüm</span>
              <h2>{item.name}</h2>
              <p>{item.description ?? "Seri açıklaması eklenmemiş."}</p>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Henüz seri yok"
          description="Yayın serileri oluşturulduğunda burada listelenecek."
        />
      )}
    </PageShell>
  );
}
