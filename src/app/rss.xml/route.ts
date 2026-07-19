import { db } from "@/server/db";
import { getPublicConfig } from "@/lib/env";

const escapeXml = (value: string) =>
  value.replace(
    /[<>&'"]/g,
    (char) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[char] ?? char,
  );

export async function GET() {
  const config = getPublicConfig();
  const posts = await db.post.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      publishedAt: { lte: new Date() },
    },
    orderBy: { publishedAt: "desc" },
    take: 30,
    include: { author: { select: { displayName: true, username: true } } },
  });
  const items = posts
    .map(
      (post) =>
        `<item><title>${escapeXml(post.title)}</title><link>${escapeXml(new URL(`/haberler/${post.slug}`, config.appUrl).toString())}</link><guid isPermaLink="true">${escapeXml(new URL(`/haberler/${post.slug}`, config.appUrl).toString())}</guid><description>${escapeXml(post.excerpt ?? "")}</description><author>${escapeXml(post.author.displayName ?? post.author.username)}</author><pubDate>${(post.publishedAt ?? post.createdAt).toUTCString()}</pubDate></item>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(config.appName)}</title><link>${escapeXml(config.appUrl)}</link><description>Scarlet Satellite Blog yayın akışı</description><language>tr</language>${items}</channel></rss>`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, stale-while-revalidate=3600",
    },
  });
}
