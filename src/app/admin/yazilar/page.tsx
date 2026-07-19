import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { SettingsForm } from "@/components/settings-form";
import { bulkPostAction } from "@/server/actions/admin-actions";
import { requirePermission } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";
import type { PostStatus, Prisma } from "@prisma/client";

const statuses = [
  "DRAFT",
  "PENDING_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export default async function AdminPosts({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("posts.review");
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const status = statuses.includes(query.status as PostStatus)
    ? (query.status as PostStatus)
    : undefined;
  const where: Prisma.PostWhereInput = {
    ...(status ? { status } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" } },
            {
              author: { username: { contains: query.q, mode: "insensitive" } },
            },
          ],
        }
      : {}),
    ...(query.author ? { authorId: query.author } : {}),
    ...(query.category
      ? { categories: { some: { categoryId: query.category } } }
      : {}),
  };
  const take = 25;
  const [posts, total, authors, categories, csrf] = await Promise.all([
    db.post.findMany({
      where,
      include: {
        author: { select: { username: true } },
        categories: { include: { category: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    db.post.count({ where }),
    db.user.findMany({
      where: { authoredPosts: { some: {} } },
      select: { id: true, username: true },
      orderBy: { username: "asc" },
    }),
    db.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    createCsrfToken(),
  ]);
  return (
    <PageShell title="Yazı yönetimi" description={`${total} yazı bulundu.`}>
      <form className="adminFilters">
        <input
          name="q"
          defaultValue={query.q}
          placeholder="Başlık veya yazar ara"
        />
        <select name="status" defaultValue={status ?? ""}>
          <option value="">Tüm durumlar</option>
          {statuses.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select name="author" defaultValue={query.author}>
          <option value="">Tüm yazarlar</option>
          {authors.map((item) => (
            <option key={item.id} value={item.id}>
              @{item.username}
            </option>
          ))}
        </select>
        <select name="category" defaultValue={query.category}>
          <option value="">Tüm kategoriler</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button className="uiButton">Filtrele</button>
      </form>
      <SettingsForm
      action={bulkPostAction}
      csrf={csrf}
      submitLabel="Toplu işlemi uygula"
      confirmMessage="Seçili yazılara toplu işlem uygulamak istediğinizden emin misiniz?"
      >
        <label>
          Toplu işlem
          <select name="intent" required>
            <option value="archive">Arşivle</option>
            <option value="restore">Geri yükle ve taslağa al</option>
            <option value="publish">Yayınla</option>
          </select>
        </label>
        <div className="adminTable">
          {posts.map((post) => (
            <label className="adminTableRow" key={post.id}>
              <input type="checkbox" name="postIds" value={post.id} />
              <span>
                <Link href={`/admin/yazilar/${post.id}`}>
                  <strong>{post.title}</strong>
                </Link>
                <small>@{post.author.username}</small>
              </span>
              <span>{post.status}</span>
              <span>
                {post.categories
                  .map(({ category }) => category.name)
                  .join(", ") || "—"}
              </span>
              <time>{post.updatedAt.toLocaleDateString("tr-TR")}</time>
            </label>
          ))}
        </div>
      </SettingsForm>
      <nav className="pagination">
        <Link
          aria-disabled={page <= 1}
          href={{ query: { ...query, page: Math.max(1, page - 1) } }}
        >
          Önceki
        </Link>
        <span>
          {page} / {Math.max(1, Math.ceil(total / take))}
        </span>
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
