import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { requirePermission } from "@/server/authorization";
import { db } from "@/server/db";

export default async function AdminWikiPage() {
  await requirePermission("wiki.edit");
  const pages = await db.wikiPage.findMany({
    include: {
      lastEditor: { select: { username: true, displayName: true } },
      _count: { select: { revisions: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <PageShell
      title="Wiki yönetimi"
      description="Taslak, yayın, arşiv, kilit ve revizyon işlemlerini yönetin."
    >
      <div className="adminToolbar">
        <Link className="uiButton" href="/admin/wiki/yeni">
          Yeni Wiki sayfası
        </Link>
      </div>
      {pages.length ? (
        <div className="adminTable" role="table">
          {pages.map((page) => (
            <article className="adminTableRow" key={page.id}>
              <div>
                <strong>
                  <Link href={`/admin/wiki/${page.id}`}>{page.title}</Link>
                </strong>
                <small>/{page.slug}</small>
              </div>
              <Badge
                tone={
                  page.status === "PUBLISHED"
                    ? "azure"
                    : page.status === "ARCHIVED"
                      ? "neutral"
                      : "amber"
                }
              >
                {page.status}
              </Badge>
              {page.lockedAt ? <Badge tone="scarlet">Kilitli</Badge> : null}
              {page.deletedAt ? <Badge tone="scarlet">Silinmiş</Badge> : null}
              <span>{page._count.revisions} revizyon</span>
              <small>
                {page.lastEditor.displayName ?? page.lastEditor.username} ·{" "}
                {page.updatedAt.toLocaleString("tr-TR")}
              </small>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Wiki sayfası yok"
          description="İlk Wiki sayfasını oluşturabilirsiniz."
        />
      )}
    </PageShell>
  );
}
