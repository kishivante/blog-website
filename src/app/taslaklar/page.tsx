import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/ui/primitives";
import { requireUser } from "@/server/authorization";
import { db } from "@/server/db";

export const metadata: Metadata = {
  title: "Taslaklar",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const session = await requireUser();
  const posts = await db.post.findMany({
    where: {
      authorId: session.userId,
      status: { in: ["DRAFT", "CHANGES_REQUESTED", "REJECTED"] },
      deletedAt: null,
    },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <PageShell
      title="Taslaklar"
      description="Yayınlanmamış ve düzeltme bekleyen yazılarınız."
    >
      <div className="listHeader">
        <Link className="uiButton" href="/yazi/yeni">
          Yeni yazı
        </Link>
      </div>
      {posts.length ? (
        <div className="draftList">
          {posts.map((post) => (
            <article className="settingsCard" key={post.id}>
              <div>
                <span className="uiBadge uiBadge--amber">{post.status}</span>
                <h2>
                  <Link href={`/yazi/${post.id}/duzenle`}>{post.title}</Link>
                </h2>
                <p>
                  {post.requestedChanges ??
                    post.rejectionReason ??
                    post.excerpt ??
                    "Özet eklenmedi."}
                </p>
              </div>
              <small>
                Sürüm {post.version} · {post.updatedAt.toLocaleString("tr-TR")}
              </small>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Taslağınız yok"
          description="Yeni bir yazı oluşturduğunuzda burada görünecek."
        />
      )}
    </PageShell>
  );
}
