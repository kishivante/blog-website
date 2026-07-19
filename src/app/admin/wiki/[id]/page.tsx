import { notFound } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import { WikiEditorForm } from "@/components/wiki-editor-form";
import {
  saveWikiAction,
  restoreWikiRevisionAction,
  setWikiDeletedAction,
} from "@/server/actions/wiki-actions";
import { requirePermission } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";
import { wikiRepository } from "@/repositories/wiki-repository";

const emptyContent: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
const plainText = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function RevisionDiff({
  previous,
  current,
}: {
  previous?: string;
  current: string;
}) {
  const before = plainText(previous ?? "");
  const after = plainText(current);
  if (!previous) return <p className="diffAdded">{after}</p>;
  if (before === after) return <p>Metin içeriğinde değişiklik yok.</p>;
  return (
    <div className="revisionDiff">
      <del>{before}</del>
      <ins>{after}</ins>
    </div>
  );
}

export default async function AdminWikiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("wiki.edit");
  const { id } = await params;
  const [page, categories, tags, pages, csrf] = await Promise.all([
    id === "yeni" ? null : wikiRepository.findAdmin(id),
    db.category.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.tag.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.wikiPage.findMany({
      where: { deletedAt: null },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    createCsrfToken(),
  ]);
  if (id !== "yeni" && !page) notFound();
  const value = page
    ? {
        id: page.id,
        title: page.title,
        slug: page.slug,
        summary: page.summary ?? "",
        content: page.content as JSONContent,
        categoryId: page.categoryId,
        tagIds: page.tags.map(({ tagId }) => tagId),
        linkedPageIds: page.outgoingLinks.map(({ targetId }) => targetId),
        status:
          page.status === "PENDING_REVIEW" ? ("DRAFT" as const) : page.status,
        locked: Boolean(page.lockedAt),
        lockedReason: page.lockedReason,
        version: page.version,
      }
    : {
        title: "",
        slug: "",
        summary: "",
        content: emptyContent,
        categoryId: "",
        tagIds: [],
        linkedPageIds: [],
        status: "DRAFT" as const,
        locked: false,
        lockedReason: "",
        version: 1,
      };
  return (
    <main className="pageShell adminWikiEditor" id="main-content">
      <WikiEditorForm
        action={saveWikiAction}
        csrf={csrf}
        value={value}
        categories={categories}
        tags={tags}
        pages={pages}
      />
      {page ? (
        <aside className="wikiHistory">
          <header>
            <h2>Revizyon geçmişi</h2>
            <span>Güncel sürüm: {page.revisionNumber}</span>
          </header>
          {page.revisions.map((revision, index) => {
            const previous = page.revisions[index + 1];
            return (
              <details key={revision.id} className="revisionCard">
                <summary>
                  <strong>Revizyon {revision.revisionNumber}</strong>
                  <span>
                    {revision.changeSummary ?? "Değişiklik özeti yok"}
                  </span>
                  <small>
                    {revision.editor.displayName ?? revision.editor.username} ·{" "}
                    {revision.createdAt.toLocaleString("tr-TR")}
                  </small>
                </summary>
                <RevisionDiff
                  previous={previous?.renderedContent}
                  current={revision.renderedContent}
                />
                {revision.revisionNumber !== page.revisionNumber &&
                !page.lockedAt ? (
                  <form action={restoreWikiRevisionAction}>
                    <input type="hidden" name="_csrf" value={csrf} />
                    <input type="hidden" name="pageId" value={page.id} />
                    <input
                      type="hidden"
                      name="revisionId"
                      value={revision.id}
                    />
                    <input type="hidden" name="version" value={page.version} />
                    <button className="quietButton">
                      Bu revizyona geri dön
                    </button>
                  </form>
                ) : null}
              </details>
            );
          })}
          <form action={setWikiDeletedAction} className="dangerZone">
            <input type="hidden" name="_csrf" value={csrf} />
            <input type="hidden" name="pageId" value={page.id} />
            <button
              className="quietButton"
              name="intent"
              value={page.deletedAt ? "restore" : "delete"}
            >
              {page.deletedAt
                ? "Soft delete işlemini geri al"
                : "Wiki sayfasını soft delete ile sil"}
            </button>
          </form>
        </aside>
      ) : null}
    </main>
  );
}
