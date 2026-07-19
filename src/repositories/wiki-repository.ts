import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";

const pageSize = 12;

export async function listPublishedWiki(query: string, page: number) {
  const where = { status: "PUBLISHED" as const, deletedAt: null };
  if (!query) {
    const [items, total] = await Promise.all([
      db.wikiPage.findMany({
        where,
        include: {
          category: true,
          tags: { include: { tag: true } },
          lastEditor: { select: { username: true, displayName: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.wikiPage.count({ where }),
    ]);
    return { items, total, pageSize };
  }

  const matches = await db.$queryRaw<
    Array<{ id: string; rank: number }>
  >(Prisma.sql`
    SELECT DISTINCT w."id",
      ts_rank(
        to_tsvector('simple', coalesce(w."title", '') || ' ' || coalesce(w."summary", '') || ' ' || coalesce(w."renderedContent", '')),
        websearch_to_tsquery('simple', ${query})
      ) AS rank
    FROM "WikiPage" w
    LEFT JOIN "Category" c ON c."id" = w."categoryId"
    LEFT JOIN "WikiTag" wt ON wt."wikiPageId" = w."id"
    LEFT JOIN "Tag" t ON t."id" = wt."tagId"
    WHERE w."status" = 'PUBLISHED'::"WikiStatus"
      AND w."deletedAt" IS NULL
      AND (
        to_tsvector('simple', coalesce(w."title", '') || ' ' || coalesce(w."summary", '') || ' ' || coalesce(w."renderedContent", ''))
          @@ websearch_to_tsquery('simple', ${query})
        OR c."name" ILIKE ${`%${query}%`}
        OR t."name" ILIKE ${`%${query}%`}
      )
    ORDER BY rank DESC, w."id"
  `);
  const ids = matches
    .slice((page - 1) * pageSize, page * pageSize)
    .map(({ id }) => id);
  const unordered = await db.wikiPage.findMany({
    where: { id: { in: ids }, ...where },
    include: {
      category: true,
      tags: { include: { tag: true } },
      lastEditor: { select: { username: true, displayName: true } },
    },
  });
  const byId = new Map(unordered.map((item) => [item.id, item]));
  return {
    items: ids.flatMap((id) => byId.get(id) ?? []),
    total: matches.length,
    pageSize,
  };
}

export const wikiRepository = {
  findPublished(slug: string) {
    return db.wikiPage.findFirst({
      where: { slug, status: "PUBLISHED", deletedAt: null },
      include: {
        category: true,
        tags: { include: { tag: true } },
        lastEditor: { select: { username: true, displayName: true } },
        outgoingLinks: {
          include: {
            target: {
              select: {
                slug: true,
                title: true,
                summary: true,
                status: true,
                deletedAt: true,
              },
            },
          },
        },
        incomingLinks: {
          include: {
            source: {
              select: {
                slug: true,
                title: true,
                status: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });
  },
  findAdmin(id: string) {
    return db.wikiPage.findUnique({
      where: { id },
      include: {
        category: true,
        tags: { include: { tag: true } },
        outgoingLinks: true,
        revisions: {
          orderBy: { revisionNumber: "desc" },
          include: {
            editor: { select: { username: true, displayName: true } },
          },
        },
      },
    });
  },
};
