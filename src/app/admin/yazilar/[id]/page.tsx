import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { SettingsForm } from "@/components/settings-form";
import {
  reviewPostAction,
  archivePostAction,
  restoreRevisionAction,
} from "@/server/actions/post-actions";
import { requirePermission } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";

export default async function AdminPostDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("posts.review");
  const { id } = await params;
  const [post, csrf] = await Promise.all([
    db.post.findUnique({
      where: { id },
      include: {
        author: true,
        reviewer: true,
        revisions: {
          orderBy: { revisionNumber: "desc" },
          include: { editor: { select: { username: true } } },
        },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    }),
    createCsrfToken(),
  ]);
  if (!post) notFound();
  return (
    <PageShell
      title={post.title}
      description={`@${post.author.username} · ${post.status} · sürüm ${post.version}`}
    >
      <div className="adminDetailGrid">
        <section className="settingsCard">
          <h2>Yazı bilgileri</h2>
          <p>{post.excerpt || "Özet yok."}</p>
          <p>
            Kategoriler:{" "}
            {post.categories.map(({ category }) => category.name).join(", ") ||
              "—"}
          </p>
          <p>
            Etiketler: {post.tags.map(({ tag }) => tag.name).join(", ") || "—"}
          </p>
          {post.slug ? (
            <Link href={`/haberler/${post.slug}`}>Yayın görünümü</Link>
          ) : null}
        </section>
        <SettingsForm
          action={reviewPostAction}
          csrf={csrf}
          submitLabel="İnceleme kararını uygula"
        >
          <input type="hidden" name="postId" value={post.id} />
          <label>
            Karar
            <select name="decision">
              <option value="APPROVED">Onayla</option>
              <option value="CHANGES_REQUESTED">Düzeltme iste</option>
              <option value="REJECTED">Reddet</option>
              <option value="PUBLISHED">Yayınla</option>
              <option value="SCHEDULED">Zamanla</option>
            </select>
          </label>
          <label>
            Not
            <textarea name="note" maxLength={2000} />
          </label>
          <label>
            Yayın zamanı
            <input type="datetime-local" name="scheduledAt" />
          </label>
        </SettingsForm>
      </div>
      {post.status === "PUBLISHED" ? (
        <SettingsForm
          action={archivePostAction}
          csrf={csrf}
          submitLabel="Yazıyı arşivle"
        >
          <input type="hidden" name="postId" value={post.id} />
        </SettingsForm>
      ) : null}
      <section className="wikiHistory">
        <h2>Revizyonlar</h2>
        {post.revisions.map((revision) => (
          <article className="revisionCard" key={revision.id}>
            <strong>
              #{revision.revisionNumber} · @{revision.editor.username}
            </strong>
            <small>{revision.createdAt.toLocaleString("tr-TR")}</small>
            <p>{revision.changeSummary ?? "Değişiklik özeti yok."}</p>
            {revision.revisionNumber !== post.revisionNumber ? (
              <SettingsForm
                action={restoreRevisionAction}
                csrf={csrf}
                submitLabel="Bu revizyona dön"
              >
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="revisionId" value={revision.id} />
                <input type="hidden" name="version" value={post.version} />
              </SettingsForm>
            ) : null}
          </article>
        ))}
      </section>
    </PageShell>
  );
}
