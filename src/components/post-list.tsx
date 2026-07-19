import Link from "next/link";

type PostSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
  author: { username: string; displayName: string | null };
};

export function PostList({ posts }: { posts: PostSummary[] }) {
  if (posts.length === 0) {
    return <p className="emptyState">Henüz yayımlanmış içerik bulunmuyor.</p>;
  }
  return (
    <div className="postGrid">
      {posts.map((post) => (
        <article className="postCard" key={post.id}>
          <h2>
            <Link href={`/haberler/${post.slug}`}>{post.title}</Link>
          </h2>
          {post.excerpt ? <p>{post.excerpt}</p> : null}
          <small>{post.author.displayName ?? post.author.username}</small>
        </article>
      ))}
    </div>
  );
}
