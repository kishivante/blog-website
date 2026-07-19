import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import { PostEditorForm } from "@/components/post-editor-form";
import { SettingsForm } from "@/components/settings-form";
import { requireUser } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";
import {
  archivePostAction,
  restoreRevisionAction,
  savePostAction,
} from "@/server/actions/post-actions";

export const metadata: Metadata = {
  title: "Yazıyı düzenle",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireUser();
  const { id } = await params;
  const [post, categories, tags, series] = await Promise.all([
    db.post.findFirst({
      where: { id, authorId: session.userId, deletedAt: null },
      include: {
        categories: true,
        tags: true,
        reviews: {
          include: {
            reviewer: { select: { username: true, displayName: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        revisions: { orderBy: { createdAt: "desc" }, take: 12 },
      },
    }),
    db.category.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.tag.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.series.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!post) notFound();
  const banner = post.bannerSettings as { color?: string } | null;
  const csrf = await createCsrfToken();
  const permissions = new Set(
    session.user.roles.flatMap(({ role }) =>
      role.permissions.map(({ permission }) => permission.key),
    ),
  );
  return (
    <main id="main-content" className="composerPage">
      {post.requestedChanges || post.rejectionReason ? (
        <aside className="reviewNotice">
          <strong>Editör notu</strong>
          <p>{post.requestedChanges ?? post.rejectionReason}</p>
        </aside>
      ) : null}
      <PostEditorForm
        action={savePostAction}
        csrf={csrf}
        categories={categories}
        tags={tags}
        series={series}
        value={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? "",
          content: post.content as JSONContent,
          categoryId: post.categories.find((item) => item.isPrimary)
            ?.categoryId,
          tagIds: post.tags.map((item) => item.tagId),
          seriesId: post.seriesId ?? undefined,
          seriesOrder: post.seriesOrder,
          coverImage: post.coverImage,
          bannerColor: banner?.color,
          allowComments: post.allowComments,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
          canonicalUrl: post.canonicalUrl,
          version: post.version,
        }}
      />
      <section className="revisionPanel">
        <h2>İnceleme ve revizyon geçmişi</h2>
        <div className="revisionGrid">
          {post.reviews.map((review) => (
            <article key={review.id}>
              <strong>{review.decision}</strong>
              <p>{review.note ?? "Not eklenmedi."}</p>
              <small>
                {review.reviewer?.displayName ??
                  review.reviewer?.username ??
                  "Sistem"}{" "}
                · {review.createdAt.toLocaleString("tr-TR")}
              </small>
            </article>
          ))}
        </div>
        {post.revisions.length ? (
          <div className="revisionGrid">
            {post.revisions.map((revision) => (
              <article key={revision.id}>
                <strong>Sürüm {revision.revisionNumber}</strong>
                <p>{revision.changeSummary ?? "Önceki sürüm"}</p>
                <SettingsForm
                  action={restoreRevisionAction}
                  csrf={csrf}
                  submitLabel="Bu sürümü geri yükle"
                >
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="revisionId" value={revision.id} />
                  <input type="hidden" name="version" value={post.version} />
                </SettingsForm>
              </article>
            ))}
          </div>
        ) : null}
      </section>
      {post.status === "PUBLISHED" && permissions.has("posts.publish") ? (
        <section className="settingsCard dangerZone">
          <h2>Yayını arşivle</h2>
          <SettingsForm
            action={archivePostAction}
            csrf={csrf}
            submitLabel="Yazıyı arşivle"
          >
            <input type="hidden" name="postId" value={post.id} />
          </SettingsForm>
        </section>
      ) : null}
    </main>
  );
}
