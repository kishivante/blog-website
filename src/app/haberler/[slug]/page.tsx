import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bookmark, CalendarDays, Eye, Heart, Share2 } from "lucide-react";
import type { JSONContent } from "@tiptap/core";
import { Avatar } from "@/components/ui/primitives";
import { PostCard } from "@/components/content-cards";
import { postRepository } from "@/repositories/post-repository";
import { extractHeadings } from "@/services/post-content-service";
import { getSession } from "@/server/session";
import { createCsrfToken } from "@/server/csrf";
import {
  createCommentAction,
  toggleBookmarkAction,
  togglePostLikeAction,
} from "@/server/actions/post-interaction-actions";
import { db } from "@/server/db";
import { getPublicConfig } from "@/lib/env";
import { getRequestContext } from "@/server/request-context";
import { recordPostView } from "@/services/post-view-service";
import { CommentThread } from "@/components/comment-thread";
import { SettingsForm } from "@/components/settings-form";
import { createReportAction } from "@/server/actions/report-actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await postRepository.findPublishedBySlug(slug);
  if (!post)
    return {
      title: "Yazı bulunamadı",
      robots: { index: false, follow: false },
    };
  const url =
    post.canonicalUrl ??
    new URL(`/haberler/${post.slug}`, getPublicConfig().appUrl).toString();
  const title = post.seoTitle ?? post.title;
  const description = post.seoDescription ?? post.excerpt ?? "";
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      images:
        post.socialImage || post.coverImage
          ? [{ url: post.socialImage ?? post.coverImage! }]
          : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images:
        post.socialImage || post.coverImage
          ? [post.socialImage ?? post.coverImage!]
          : undefined,
    },
    robots: { index: true, follow: true },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await postRepository.findPublishedBySlug(slug);
  if (!post) {
    const old = await postRepository.findRedirect(slug);
    if (old?.post.status === "PUBLISHED" && !old.post.deletedAt)
      redirect(`/haberler/${old.post.slug}`);
    notFound();
  }
  const session = await getSession();
  const permissions = new Set(
    session?.user.roles.flatMap(({ role }) =>
      role.permissions.map(({ permission }) => permission.key),
    ) ?? [],
  );
  const [related, [previous, next]] = await Promise.all([
    postRepository.related(
      post.id,
      post.categories.map((item) => item.categoryId),
    ),
    postRepository.adjacent(post.publishedAt ?? post.createdAt, post.id),
  ]);
  const context = await getRequestContext();
  const viewAggregate = await recordPostView({
    postId: post.id,
    viewerId: session?.userId,
    context,
  });
  const [liked, bookmarked] = session
    ? await Promise.all([
        db.postLike.findUnique({
          where: { postId_userId: { postId: post.id, userId: session.userId } },
        }),
        db.postBookmark.findUnique({
          where: { postId_userId: { postId: post.id, userId: session.userId } },
        }),
      ])
    : [null, null];
  const csrf = session ? await createCsrfToken() : "";
  const headings = extractHeadings(post.content as JSONContent);
  const role = post.author.roles.sort(
    (a, b) => b.role.priority - a.role.priority,
  )[0]?.role;
  const canonical =
    post.canonicalUrl ??
    new URL(`/haberler/${post.slug}`, getPublicConfig().appUrl).toString();
  const structured = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    mainEntityOfPage: canonical,
    image: post.coverImage ?? undefined,
    author: {
      "@type": "Person",
      name: post.author.displayName ?? post.author.username,
      url: new URL(
        `/kullanici/${post.author.username}`,
        getPublicConfig().appUrl,
      ).toString(),
    },
    publisher: { "@type": "Organization", name: getPublicConfig().appName },
  };
  return (
    <main
      id="main-content"
      className="articlePage"
      data-role={role?.code ?? "USER"}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
        }}
      />
      <header
        className="articleHero"
        style={
          {
            "--article-accent": role?.color ?? "var(--role-user)",
          } as React.CSSProperties
        }
      >
        {post.coverImage ? (
          <Image
            src={post.coverImage}
            alt=""
            fill
            sizes="100vw"
            priority
            unoptimized
          />
        ) : null}
        <div className="articleHeroShade" />
        <div className="articleHeroContent">
          <div className="articleTaxonomy">
            {post.categories.map(({ category }) => (
              <Link key={category.id} href={`/kategoriler/${category.slug}`}>
                {category.name}
              </Link>
            ))}
          </div>
          <h1>{post.title}</h1>
          {post.excerpt ? <p>{post.excerpt}</p> : null}
          <div className="articleByline">
            <Avatar
              src={post.author.avatar}
              name={post.author.displayName ?? post.author.username}
            />
            <div>
              <Link href={`/kullanici/${post.author.username}`}>
                {post.author.displayName ?? post.author.username}
              </Link>
              <span>{role?.name ?? "Yazar"}</span>
            </div>
            <span>
              <CalendarDays />
              {post.publishedAt?.toLocaleDateString("tr-TR")}
            </span>
            <span>{post.readingTimeMinutes} dk okuma</span>
          </div>
        </div>
      </header>
      <div className="articleLayout">
        <aside className="articleToc">
          <strong>İçindekiler</strong>
          {headings.length ? (
            <ol>
              {headings.map((heading) => (
                <li data-level={heading.level} key={heading.id}>
                  <a href={`#${heading.id}`}>{heading.text}</a>
                </li>
              ))}
            </ol>
          ) : (
            <p>Başlık bulunmuyor.</p>
          )}
        </aside>
        <article
          className="richText articleContent"
          dangerouslySetInnerHTML={{ __html: post.renderedContent }}
        />
        <aside className="articleShare">
          <span>
            <Eye />
            {Number(viewAggregate?.totalViews ?? 0)}
          </span>
          {session ? (
            <>
              <form action={togglePostLikeAction}>
                <input type="hidden" name="_csrf" value={csrf} />
                <input type="hidden" name="postId" value={post.id} />
                <button aria-label={liked ? "Beğeniyi kaldır" : "Yazıyı beğen"}>
                  <Heart fill={liked ? "currentColor" : "none"} />
                  {post._count.likes}
                </button>
              </form>
              <form action={toggleBookmarkAction}>
                <input type="hidden" name="_csrf" value={csrf} />
                <input type="hidden" name="postId" value={post.id} />
                <button
                  aria-label={bookmarked ? "Kayıttan çıkar" : "Yazıyı kaydet"}
                >
                  <Bookmark fill={bookmarked ? "currentColor" : "none"} />
                </button>
              </form>
            </>
          ) : null}
          <a
            href={`https://x.com/intent/post?url=${encodeURIComponent(canonical)}&text=${encodeURIComponent(post.title)}`}
            rel="noopener noreferrer"
            target="_blank"
            aria-label="X üzerinde paylaş"
          >
            <Share2 />
          </a>
        </aside>
      </div>
      <footer className="articleFooter">
        <div className="tagRow">
          {post.tags.map(({ tag }) => (
            <Link key={tag.id} href={`/etiketler/${tag.slug}`}>
              #{tag.name}
            </Link>
          ))}
        </div>
        {session ? (
          <details className="reportDisclosure">
            <summary>Bu yazıyı raporla</summary>
            <SettingsForm
              action={createReportAction}
              csrf={csrf}
              submitLabel="Raporu gönder"
            >
              <input type="hidden" name="targetType" value="POST" />
              <input type="hidden" name="targetId" value={post.id} />
              <label>
                Neden
                <select name="reason">
                  <option value="SPAM">Spam</option>
                  <option value="MISINFORMATION">Yanlış bilgi</option>
                  <option value="COPYRIGHT">Telif hakkı</option>
                  <option value="DANGEROUS">Tehlikeli içerik</option>
                  <option value="OTHER">Diğer</option>
                </select>
              </label>
              <label>
                Açıklama
                <textarea name="details" maxLength={2000} />
              </label>
            </SettingsForm>
          </details>
        ) : null}
        {post.series ? (
          <p className="seriesNotice">
            <strong>{post.series.name}</strong> serisinin{" "}
            {post.seriesOrder ?? ""}. bölümü
          </p>
        ) : null}
        <nav className="adjacentPosts">
          {previous ? (
            <Link href={`/haberler/${previous.slug}`}>
              <small>Önceki</small>
              {previous.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/haberler/${next.slug}`}>
              <small>Sonraki</small>
              {next.title}
            </Link>
          ) : null}
        </nav>
      </footer>
      <section className="articleSection">
        <h2>Yazar</h2>
        <div className="authorBio">
          <Avatar
            src={post.author.avatar}
            name={post.author.displayName ?? post.author.username}
            size="lg"
          />
          <div>
            <h3>{post.author.displayName ?? post.author.username}</h3>
            <p>{post.author.biography ?? "Yazar biyografisi eklenmemiş."}</p>
          </div>
        </div>
      </section>
      <section className="articleSection">
        <h2>Benzer yazılar</h2>
        {related.length ? (
          <div className="postGridNew">
            {related.map((item) => (
              <PostCard key={item.id} post={item} />
            ))}
          </div>
        ) : (
          <p className="muted">Benzer yayın bulunamadı.</p>
        )}
      </section>
      <section className="articleSection" id="yorumlar">
        <h2>Yorumlar ({post._count.comments})</h2>
        {post.allowComments && session ? (
          <form className="commentForm" action={createCommentAction}>
            <input type="hidden" name="_csrf" value={csrf} />
            <input type="hidden" name="postId" value={post.id} />
            <label>
              Yorumunuz
              <textarea
                name="content"
                minLength={2}
                maxLength={3000}
                required
              />
            </label>
            <button className="uiButton">Yorum gönder</button>
          </form>
        ) : (
          <p className="muted">
            {post.allowComments
              ? "Yorum yapmak için giriş yapın."
              : "Bu yazıda yorumlar kapalı."}
          </p>
        )}
        <CommentThread
          items={post.comments}
          postId={post.id}
          csrf={csrf}
          viewerId={session?.userId}
          canModerate={permissions.has("comments.moderate")}
        />
      </section>
    </main>
  );
}
