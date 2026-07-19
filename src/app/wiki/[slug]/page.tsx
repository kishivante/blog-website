import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { extractHeadings } from "@/services/post-content-service";
import { wikiRepository } from "@/repositories/wiki-repository";
import { getPublicConfig } from "@/lib/env";
import type { JSONContent } from "@tiptap/core";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await wikiRepository.findPublished(slug);
  if (!page)
    return { title: "Wiki sayfası bulunamadı", robots: { index: false } };
  const canonical = new URL(
    `/wiki/${page.slug}`,
    getPublicConfig().appUrl,
  ).toString();
  return {
    title: page.title,
    description: page.summary ?? undefined,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: page.title,
      description: page.summary ?? undefined,
      url: canonical,
      modifiedTime: page.updatedAt.toISOString(),
      publishedTime: page.publishedAt?.toISOString(),
    },
  };
}

export default async function WikiDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await wikiRepository.findPublished(slug);
  if (!page) notFound();
  const headings = extractHeadings(page.content as JSONContent);
  const canonical = new URL(
    `/wiki/${page.slug}`,
    getPublicConfig().appUrl,
  ).toString();
  const linked = page.outgoingLinks
    .map(({ target }) => target)
    .filter((target) => target.status === "PUBLISHED" && !target.deletedAt);
  const incoming = page.incomingLinks
    .map(({ source }) => source)
    .filter((source) => source.status === "PUBLISHED" && !source.deletedAt);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: page.title,
    description: page.summary,
    datePublished: page.publishedAt?.toISOString(),
    dateModified: page.updatedAt.toISOString(),
    url: canonical,
    author: {
      "@type": "Person",
      name: page.lastEditor.displayName ?? page.lastEditor.username,
    },
    isPartOf: {
      "@type": "WebSite",
      name: getPublicConfig().appName,
      url: getPublicConfig().appUrl,
    },
  };
  return (
    <main className="wikiDetail" id="main-content">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <nav className="breadcrumb" aria-label="Sayfa yolu">
        <Link href="/wiki">Wiki</Link>
        <span>/</span>
        <span>{page.title}</span>
      </nav>
      <header className="wikiHero">
        <span className="eyebrow">{page.category?.name ?? "Wiki"}</span>
        <h1>{page.title}</h1>
        {page.summary ? <p>{page.summary}</p> : null}
        <div className="wikiMeta">
          <span>
            Son düzenleyen:{" "}
            {page.lastEditor.displayName ?? page.lastEditor.username}
          </span>
          {page.publishedAt ? (
            <time>Yayın: {page.publishedAt.toLocaleDateString("tr-TR")}</time>
          ) : null}
          <time>Güncelleme: {page.updatedAt.toLocaleDateString("tr-TR")}</time>
        </div>
      </header>
      <div className="wikiLayout">
        {headings.length ? (
          <aside className="wikiToc">
            <strong>İçindekiler</strong>
            <ol>
              {headings.map((heading) => (
                <li key={heading.id} data-level={heading.level}>
                  <a href={`#${heading.id}`}>{heading.text}</a>
                </li>
              ))}
            </ol>
          </aside>
        ) : null}
        <article
          className="richText wikiContent"
          dangerouslySetInnerHTML={{ __html: page.renderedContent }}
        />
      </div>
      {page.tags.length ? (
        <div className="tagRow">
          {page.tags.map(({ tag }) => (
            <span className="uiBadge uiBadge--neutral" key={tag.id}>
              {tag.name}
            </span>
          ))}
        </div>
      ) : null}
      {linked.length || incoming.length ? (
        <section className="linkedWiki">
          <h2>Bağlantılı Wiki sayfaları</h2>
          <ul>
            {[
              ...linked,
              ...incoming.filter(
                (item) => !linked.some((target) => target.slug === item.slug),
              ),
            ].map((item) => (
              <li key={item.slug}>
                <Link href={`/wiki/${item.slug}`}>{item.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
