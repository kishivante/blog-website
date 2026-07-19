import "server-only";
import type { JSONContent } from "@tiptap/core";
import type { Prisma, WikiStatus } from "@prisma/client";
import { db } from "@/server/db";
import { renderPostContent } from "@/services/post-content-service";
import type { RequestContext } from "@/server/request-context";

type WikiInput = {
  id?: string;
  title: string;
  slug: string;
  summary: string;
  content: object;
  categoryId: string;
  tagIds: string[];
  linkedPageIds: string[];
  changeSummary: string;
  status: WikiStatus;
  locked: boolean;
  lockedReason: string;
  version: number;
};

const asJson = (value: object) => value as Prisma.InputJsonValue;

export class WikiConflictError extends Error {
  constructor(
    readonly currentTitle: string,
    readonly currentText: string,
  ) {
    super("Düzenleme çakışması: sayfa başka bir kullanıcı tarafından güncellendi.");
  }
}

export async function saveWikiPage(
  actorId: string,
  input: WikiInput,
  context: RequestContext,
) {
  const content = input.content as JSONContent;
  const { renderedContent } = renderPostContent(content);
  const tagIds = [...new Set(input.tagIds)];
  const linkedPageIds = [...new Set(input.linkedPageIds)].filter(
    (id) => id !== input.id,
  );

  return db.$transaction(async (tx) => {
    const existing = input.id
      ? await tx.wikiPage.findUnique({ where: { id: input.id } })
      : null;
    if (input.id && !existing) throw new Error("Wiki sayfası bulunamadı.");
    if (existing?.lockedAt && input.locked)
      throw new Error(
        "Wiki sayfası kilitli. Düzenlemek için önce kilidi kaldırın.",
      );
    const duplicate = await tx.wikiPage.findFirst({
      where: { slug: input.slug, id: input.id ? { not: input.id } : undefined },
      select: { id: true },
    });
    if (duplicate)
      throw new Error(
        "Bu slug başka bir Wiki sayfası tarafından kullanılıyor.",
      );

    const publishedAt =
      input.status === "PUBLISHED"
        ? (existing?.publishedAt ?? new Date())
        : existing?.publishedAt;
    let pageId: string;
    let revisionNumber: number;
    if (existing) {
      revisionNumber = existing.revisionNumber + 1;
      const updated = await tx.wikiPage.updateMany({
        where: { id: existing.id, version: input.version },
        data: {
          title: input.title,
          slug: input.slug,
          summary: input.summary,
          content: asJson(input.content),
          renderedContent,
          categoryId: input.categoryId || null,
          status: input.status,
          lastEditorId: actorId,
          revisionNumber,
          version: { increment: 1 },
          lockedAt: input.locked ? (existing.lockedAt ?? new Date()) : null,
          lockedReason: input.locked
            ? input.lockedReason || "Yönetim tarafından kilitlendi."
            : null,
          publishedAt,
          deletedAt: null,
        },
      });
      if (updated.count !== 1) {
        const current = await tx.wikiPage.findUniqueOrThrow({
          where: { id: existing.id },
          select: { title: true, renderedContent: true },
        });
        throw new WikiConflictError(
          current.title,
          current.renderedContent
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
        );
      }
      pageId = existing.id;
    } else {
      const created = await tx.wikiPage.create({
        data: {
          title: input.title,
          slug: input.slug,
          summary: input.summary,
          content: asJson(input.content),
          renderedContent,
          categoryId: input.categoryId || null,
          status: input.status,
          creatorId: actorId,
          lastEditorId: actorId,
          lockedAt: input.locked ? new Date() : null,
          lockedReason: input.locked
            ? input.lockedReason || "Yönetim tarafından kilitlendi."
            : null,
          publishedAt,
        },
      });
      pageId = created.id;
      revisionNumber = 1;
    }

    await tx.wikiRevision.create({
      data: {
        wikiPageId: pageId,
        revisionNumber,
        editorId: actorId,
        title: input.title,
        summary: input.summary,
        content: asJson(input.content),
        renderedContent,
        changeSummary: input.changeSummary,
      },
    });
    await tx.wikiTag.deleteMany({ where: { wikiPageId: pageId } });
    if (tagIds.length) {
      await tx.wikiTag.createMany({
        data: tagIds.map((tagId) => ({ wikiPageId: pageId, tagId })),
        skipDuplicates: true,
      });
    }
    await tx.wikiLink.deleteMany({ where: { sourceId: pageId } });
    if (linkedPageIds.length) {
      await tx.wikiLink.createMany({
        data: linkedPageIds.map((targetId) => ({ sourceId: pageId, targetId })),
        skipDuplicates: true,
      });
    }
    await tx.auditLog.create({
      data: {
        actorId,
        action: existing ? "WIKI_UPDATED" : "WIKI_CREATED",
        targetType: "WikiPage",
        targetId: pageId,
        previousValue: existing
          ? {
              version: existing.version,
              revisionNumber: existing.revisionNumber,
              status: existing.status,
            }
          : undefined,
        newValue: {
          version: input.version + (existing ? 1 : 0),
          revisionNumber,
          status: input.status,
          changeSummary: input.changeSummary,
        },
        ipAddress: context.ip,
        userAgent: context.userAgent,
      },
    });
    return pageId;
  });
}

export async function restoreWikiRevision(input: {
  pageId: string;
  revisionId: string;
  actorId: string;
  expectedVersion: number;
  context: RequestContext;
}) {
  return db.$transaction(async (tx) => {
    const [page, revision] = await Promise.all([
      tx.wikiPage.findUnique({ where: { id: input.pageId } }),
      tx.wikiRevision.findFirst({
        where: { id: input.revisionId, wikiPageId: input.pageId },
      }),
    ]);
    if (!page || !revision)
      throw new Error("Wiki sayfası veya revizyon bulunamadı.");
    if (page.lockedAt)
      throw new Error("Kilitli Wiki sayfasında geri alma yapılamaz.");
    const nextRevision = page.revisionNumber + 1;
    const updated = await tx.wikiPage.updateMany({
      where: { id: page.id, version: input.expectedVersion },
      data: {
        title: revision.title,
        summary: revision.summary,
        content: revision.content as Prisma.InputJsonValue,
        renderedContent: revision.renderedContent,
        lastEditorId: input.actorId,
        revisionNumber: nextRevision,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1)
      throw new Error("Geri alma sırasında düzenleme çakışması oluştu.");
    await tx.wikiRevision.create({
      data: {
        wikiPageId: page.id,
        revisionNumber: nextRevision,
        editorId: input.actorId,
        title: revision.title,
        summary: revision.summary,
        content: revision.content as Prisma.InputJsonValue,
        renderedContent: revision.renderedContent,
        changeSummary: `${revision.revisionNumber}. revizyona geri dönüldü`,
        restoredFromId: revision.id,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "WIKI_REVISION_RESTORED",
        targetType: "WikiPage",
        targetId: page.id,
        previousValue: { revisionNumber: page.revisionNumber },
        newValue: { revisionNumber: nextRevision, restoredFromId: revision.id },
        ipAddress: input.context.ip,
        userAgent: input.context.userAgent,
      },
    });
  });
}

export async function setWikiDeleted(input: {
  pageId: string;
  actorId: string;
  restore: boolean;
  context: RequestContext;
}) {
  const page = await db.wikiPage.findUnique({
    where: { id: input.pageId },
    select: { id: true },
  });
  if (!page) throw new Error("Wiki sayfası bulunamadı.");
  await db.$transaction([
    db.wikiPage.update({
      where: { id: page.id },
      data: {
        deletedAt: input.restore ? null : new Date(),
        version: { increment: 1 },
      },
    }),
    db.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.restore ? "WIKI_RESTORED" : "WIKI_DELETED",
        targetType: "WikiPage",
        targetId: page.id,
        ipAddress: input.context.ip,
        userAgent: input.context.userAgent,
      },
    }),
  ]);
}
