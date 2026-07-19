import { db } from "@/server/db";

export async function getHomeContent() {
  const now = new Date();
  const published = {
    status: "PUBLISHED" as const,
    publishedAt: { lte: now },
    deletedAt: null,
  };
  const [featured, latest, categories, wiki, authors] = await Promise.all([
    db.post.findFirst({
      where: { ...published, featured: true },
      orderBy: { publishedAt: "desc" },
      include: {
        author: { include: { roles: { include: { role: true } } } },
        categories: { include: { category: true } },
      },
    }),
    db.post.findMany({
      where: published,
      orderBy: { publishedAt: "desc" },
      take: 6,
      include: {
        author: { include: { roles: { include: { role: true } } } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    }),
    db.category.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 8,
      include: { _count: { select: { posts: true } } },
    }),
    db.wikiPage.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 4,
      include: {
        lastEditor: { select: { username: true, displayName: true } },
      },
    }),
    db.user.findMany({
      where: {
        accountStatus: "ACTIVE",
        deletedAt: null,
        authoredPosts: { some: published },
      },
      orderBy: { authoredPosts: { _count: "desc" } },
      take: 4,
      include: {
        roles: { include: { role: true } },
        _count: { select: { authoredPosts: true } },
      },
    }),
  ]);
  return {
    featured: featured ?? latest[0] ?? null,
    latest,
    categories,
    wiki,
    authors,
  };
}
