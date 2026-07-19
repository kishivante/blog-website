import type { MetadataRoute } from "next";
import { db } from "@/server/db";
import { getPublicConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getPublicConfig().appUrl;
  const [posts, series, wiki] = await Promise.all([
    db.post.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        publishedAt: { lte: new Date() },
      },
      select: { slug: true, updatedAt: true },
    }),
    db.series.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true },
    }),
    db.wikiPage.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      select: { slug: true, updatedAt: true },
    }),
  ]);
  return [
    {
      url: new URL("/", base).toString(),
      lastModified: new Date(),
      priority: 1,
    },
    {
      url: new URL("/haberler", base).toString(),
      lastModified: new Date(),
      priority: 0.9,
    },
    {
      url: new URL("/konular", base).toString(),
      lastModified: new Date(),
      priority: 0.7,
    },
    {
      url: new URL("/wiki", base).toString(),
      lastModified: new Date(),
      priority: 0.8,
    },
    ...posts.map((post) => ({
      url: new URL(`/haberler/${post.slug}`, base).toString(),
      lastModified: post.updatedAt,
      priority: 0.8,
    })),
    ...series.map((item) => ({
      url: new URL(`/konular/${item.slug}`, base).toString(),
      lastModified: item.updatedAt,
      priority: 0.6,
    })),
    ...wiki.map((item) => ({
      url: new URL(`/wiki/${item.slug}`, base).toString(),
      lastModified: item.updatedAt,
      priority: 0.6,
    })),
  ];
}
