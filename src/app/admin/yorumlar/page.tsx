import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { moderateCommentAction } from "@/server/actions/post-interaction-actions";
import { requirePermission } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";

export default async function CommentsAdmin({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  await requirePermission("comments.moderate");
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const statuses = ["VISIBLE", "PENDING", "HIDDEN", "REMOVED"] as const;
  const status = statuses.includes(query.status as (typeof statuses)[number])
    ? (query.status as (typeof statuses)[number])
    : undefined;
  const take = 30;
  const where = {
    ...(status ? { status } : {}),
    ...(query.q
      ? { content: { contains: query.q, mode: "insensitive" as const } }
      : {}),
  };
  const [comments, total, csrf] = await Promise.all([
    db.comment.findMany({
      where,
      include: {
        author: { select: { username: true } },
        post: { select: { title: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    db.comment.count({ where }),
    createCsrfToken(),
  ]);
  return (
    <PageShell title="Yorum yönetimi" description={`${total} yorum bulundu.`}>
      <form className="adminFilters">
        <input name="q" defaultValue={query.q} placeholder="Yorum içinde ara" />
        <select name="status" defaultValue={status ?? ""}>
          <option value="">Tüm durumlar</option>
          {statuses.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button className="uiButton">Filtrele</button>
      </form>
      <div className="adminTable">
        {comments.map((comment) => (
          <article className="settingsCard" key={comment.id}>
            <header>
              <strong>@{comment.author.username}</strong>
              <span>{comment.status}</span>
              <Link href={`/haberler/${comment.post.slug}`}>
                {comment.post.title}
              </Link>
            </header>
            <p>
              {comment.deletedAt
                ? "Kullanıcı tarafından silindi."
                : comment.content || "İçerik yok."}
            </p>
            <small>
              {comment.createdAt.toLocaleString("tr-TR")}{" "}
              {comment.moderationReason ? `· ${comment.moderationReason}` : ""}
            </small>
            <form action={moderateCommentAction} className="inlineAdminForm">
              <input type="hidden" name="_csrf" value={csrf} />
              <input type="hidden" name="commentId" value={comment.id} />
              <input
                name="reason"
                minLength={5}
                maxLength={500}
                required
                placeholder="Moderasyon nedeni"
              />
              <button
                className="quietButton"
                name="intent"
                value={comment.status === "HIDDEN" ? "restore" : "hide"}
              >
                {comment.status === "HIDDEN" ? "Geri getir" : "Gizle"}
              </button>
            </form>
          </article>
        ))}
      </div>
      <nav className="pagination">
        <Link
          aria-disabled={page <= 1}
          href={{ query: { ...query, page: Math.max(1, page - 1) } }}
        >
          Önceki
        </Link>
        <span>{page}</span>
        <Link
          aria-disabled={page * take >= total}
          href={{ query: { ...query, page: page + 1 } }}
        >
          Sonraki
        </Link>
      </nav>
    </PageShell>
  );
}
