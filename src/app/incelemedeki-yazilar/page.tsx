import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/ui/primitives";
import { SettingsForm } from "@/components/settings-form";
import { requireUser } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";
import { reviewPostAction } from "@/server/actions/post-actions";

export const metadata: Metadata = {
  title: "İncelemedeki yazılar",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const session = await requireUser();
  const permissions = new Set(
    session.user.roles.flatMap(({ role }) =>
      role.permissions.map(({ permission }) => permission.key),
    ),
  );
  const reviewer = permissions.has("posts.review");
  const posts = await db.post.findMany({
    where: {
      ...(reviewer ? {} : { authorId: session.userId }),
      status: { in: ["PENDING_REVIEW", "APPROVED", "SCHEDULED"] },
      deletedAt: null,
    },
    include: {
      author: { select: { username: true, displayName: true } },
      categories: { include: { category: true } },
    },
    orderBy: { updatedAt: "asc" },
  });
  const csrf = await createCsrfToken();
  return (
    <PageShell
      title="İncelemedeki yazılar"
      description={
        reviewer
          ? "Editoryal inceleme ve yayın kuyruğu."
          : "İncelemeye gönderdiğiniz yazıların durumu."
      }
    >
      {posts.length ? (
        <div className="reviewQueue">
          {posts.map((post) => (
            <article className="settingsCard" key={post.id}>
              <header>
                <span className="uiBadge uiBadge--azure">{post.status}</span>
                <h2>{post.title}</h2>
                <p>
                  {post.author.displayName ?? post.author.username} ·{" "}
                  {post.categories[0]?.category.name ?? "Kategorisiz"} · sürüm{" "}
                  {post.version}
                </p>
              </header>
              {reviewer ? (
                <SettingsForm
                  action={reviewPostAction}
                  csrf={csrf}
                  submitLabel="Kararı kaydet"
                >
                  <input type="hidden" name="postId" value={post.id} />
                  <label>
                    Karar
                    <select
                      name="decision"
                      defaultValue={
                        post.status === "APPROVED" ? "PUBLISHED" : "APPROVED"
                      }
                    >
                      {post.status === "PENDING_REVIEW" ? (
                        <>
                          <option value="APPROVED">Onayla</option>
                          <option value="CHANGES_REQUESTED">
                            Düzeltme iste
                          </option>
                          <option value="REJECTED">Reddet</option>
                        </>
                      ) : null}
                      {permissions.has("posts.publish") &&
                      post.status === "APPROVED" ? (
                        <>
                          <option value="PUBLISHED">Şimdi yayınla</option>
                          <option value="SCHEDULED">Zamanla</option>
                        </>
                      ) : null}
                    </select>
                  </label>
                  <label>
                    Editör notu
                    <textarea name="note" maxLength={2000} rows={3} />
                  </label>
                  {permissions.has("posts.publish") &&
                  post.status === "APPROVED" ? (
                    <label>
                      Zamanlanmış yayın
                      <input name="scheduledAt" type="datetime-local" />
                    </label>
                  ) : null}
                </SettingsForm>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="İnceleme kuyruğu boş"
          description="İncelemeye gönderilen yazılar burada görünecek."
        />
      )}
    </PageShell>
  );
}
