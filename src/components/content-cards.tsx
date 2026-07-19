import Link from "next/link";
import { ArrowUpRight, BookOpen, Clock3, MessageCircle } from "lucide-react";
import { Avatar, Badge, RoleBadge } from "@/components/ui/primitives";

type PostData = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: Date | null;
  readingTimeMinutes: number;
  author: {
    username: string;
    displayName: string | null;
    avatar: string | null;
    roles: Array<{
      role: { code: "ADMIN" | "EDITOR" | "MODERATOR" | "SUPPORTER" | "USER" };
    }>;
  };
  categories: Array<{ category: { name: string; slug: string } }>;
};

export function PostCard({
  post,
  featured = false,
}: {
  post: PostData;
  featured?: boolean;
}) {
  const role = post.author.roles[0]?.role.code ?? "USER";
  return (
    <article
      className={`postCardNew ${featured ? "postCardNew--featured" : ""}`}
      data-role={role}
    >
      <div className="postCardGlow" aria-hidden="true" />
      <div className="postMeta">
        <Badge tone="scarlet">
          {post.categories[0]?.category.name ?? "Haber"}
        </Badge>
        <span>
          <Clock3 size={14} />
          {post.readingTimeMinutes} dk
        </span>
      </div>
      <h3>
        <Link href={`/haberler/${post.slug}`}>{post.title}</Link>
      </h3>
      {post.excerpt ? <p>{post.excerpt}</p> : null}
      <footer>
        <div className="authorLine">
          <Avatar
            src={post.author.avatar}
            name={post.author.displayName ?? post.author.username}
            size="sm"
          />
          <span>{post.author.displayName ?? post.author.username}</span>
          <RoleBadge role={role} />
        </div>
        <Link
          className="iconLink"
          href={`/haberler/${post.slug}`}
          aria-label={`${post.title} yazısını oku`}
        >
          <ArrowUpRight />
        </Link>
      </footer>
    </article>
  );
}

export function TopicCard({
  name,
  slug,
  count,
}: {
  name: string;
  slug: string;
  count: number;
}) {
  return (
    <Link className="topicCard" href={`/kategoriler/${slug}`}>
      <span className="topicIcon">
        <MessageCircle />
      </span>
      <span>
        <strong>{name}</strong>
        <small>{count ? `${count} içerik` : "Henüz içerik yok"}</small>
      </span>
      <ArrowUpRight />
    </Link>
  );
}

export function WikiCard({
  title,
  slug,
  summary,
  editor,
  updatedAt,
}: {
  title: string;
  slug: string;
  summary: string | null;
  editor: string;
  updatedAt: Date;
}) {
  return (
    <article className="wikiCard">
      <BookOpen aria-hidden="true" />
      <div>
        <h3>
          <Link href={`/wiki/${slug}`}>{title}</Link>
        </h3>
        {summary ? <p>{summary}</p> : null}
        <small>
          {editor} tarafından {updatedAt.toLocaleDateString("tr-TR")} tarihinde
          güncellendi
        </small>
      </div>
    </article>
  );
}
