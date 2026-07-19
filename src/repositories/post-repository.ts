import { db } from "@/server/db";
import type { Prisma } from "@prisma/client";

export const postRepository = {
  listPublished(limit: number) {
    return db.post.findMany({
      where: { status: "PUBLISHED", publishedAt: { lte: new Date() } },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        author: { select: { username: true, displayName: true } },
      },
    });
  },
  async listPublishedPage(input: {
    page: number;
    query?: string;
    category?: string;
    tag?: string;
    sort: "newest" | "oldest";
    view?: "latest" | "topics" | "editors" | "popular" | "following";
    viewerId?: string;
  }) {
    const take = 9;
    const where: Prisma.PostWhereInput = {
      status: "PUBLISHED" as const,
      publishedAt: { lte: new Date() },
      deletedAt: null,
      ...(input.view === "topics" ? { seriesId: { not: null } } : {}),
      ...(input.view === "editors"
        ? {
            author: {
              roles: {
                some: { role: { code: { in: ["ADMIN", "EDITOR"] } } },
              },
            },
          }
        : {}),
      ...(input.view === "following"
        ? {
            author: {
              followers: {
                some: { followerId: input.viewerId ?? "__anonymous__" },
              },
            },
          }
        : {}),
      ...(input.query
        ? {
            OR: [
              {
                title: { contains: input.query, mode: "insensitive" as const },
              },
              {
                excerpt: {
                  contains: input.query,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
      ...(input.category
        ? { categories: { some: { category: { slug: input.category } } } }
        : {}),
      ...(input.tag ? { tags: { some: { tag: { slug: input.tag } } } } : {}),
    };
    const orderBy: Prisma.PostOrderByWithRelationInput =
      input.view === "popular"
        ? { likes: { _count: "desc" } }
        : { publishedAt: input.sort === "oldest" ? "asc" : "desc" };
    const [items, total] = await Promise.all([
      db.post.findMany({
        where,
        orderBy,
        skip: (input.page - 1) * take,
        take,
        include: {
          author: { include: { roles: { include: { role: true } } } },
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
        },
      }),
      db.post.count({ where }),
    ]);
    return { items, total, hasNext: input.page * take < total };
  },
  findPublishedBySlug(slug: string) {
    return db.post.findFirst({
      where: {
        slug,
        status: "PUBLISHED",
        publishedAt: { lte: new Date() },
        deletedAt: null,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            biography: true,
            roles: { include: { role: true } },
          },
        },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
        series: true,
        comments: {
          where: { status: { in: ["VISIBLE", "HIDDEN"] }, depth: { lte: 3 } },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
              },
            },
            _count: { select: { likes: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { likes: true, bookmarks: true, comments: true } },
      },
    });
  },
  findRedirect(slug: string) {
    return db.postSlugRedirect.findUnique({
      where: { oldSlug: slug },
      include: {
        post: { select: { slug: true, status: true, deletedAt: true } },
      },
    });
  },
  async related(postId: string, categoryIds: string[]) {
    return db.post.findMany({
      where: {
        id: { not: postId },
        status: "PUBLISHED",
        deletedAt: null,
        categories: { some: { categoryId: { in: categoryIds } } },
      },
      orderBy: { publishedAt: "desc" },
      take: 3,
      include: {
        author: { include: { roles: { include: { role: true } } } },
        categories: { include: { category: true } },
      },
    });
  },
  async adjacent(publishedAt: Date, postId: string) {
    return Promise.all([
      db.post.findFirst({
        where: {
          id: { not: postId },
          status: "PUBLISHED",
          deletedAt: null,
          publishedAt: { lt: publishedAt },
        },
        orderBy: { publishedAt: "desc" },
        select: { title: true, slug: true },
      }),
      db.post.findFirst({
        where: {
          id: { not: postId },
          status: "PUBLISHED",
          deletedAt: null,
          publishedAt: { gt: publishedAt },
        },
        orderBy: { publishedAt: "asc" },
        select: { title: true, slug: true },
      }),
    ]);
  },
};
