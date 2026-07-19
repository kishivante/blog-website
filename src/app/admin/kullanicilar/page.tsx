import Link from "next/link";
import type { AccountStatus, Prisma } from "@prisma/client";
import { PageShell } from "@/components/page-shell";
import { requirePermission } from "@/server/authorization";
import { db } from "@/server/db";

const statuses = [
  "PENDING_VERIFICATION",
  "ACTIVE",
  "SUSPENDED",
  "DISABLED",
  "DELETED",
] as const;
export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("users.manage");
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const status = statuses.includes(query.status as AccountStatus)
    ? (query.status as AccountStatus)
    : undefined;
  const where: Prisma.UserWhereInput = {
    ...(status ? { accountStatus: status } : {}),
    ...(query.q
      ? {
          OR: [
            { username: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } },
            { displayName: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const take = 25;
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      include: {
        roles: { include: { role: true } },
        _count: {
          select: { authoredPosts: true, comments: true, sessions: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    db.user.count({ where }),
  ]);
  return (
    <PageShell
      title="Kullanıcı yönetimi"
      description={`${total} kullanıcı bulundu.`}
    >
      <form className="adminFilters">
        <input
          name="q"
          defaultValue={query.q}
          placeholder="Kullanıcı adı, e-posta veya ad"
        />
        <select name="status" defaultValue={status ?? ""}>
          <option value="">Tüm durumlar</option>
          {statuses.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button className="uiButton">Filtrele</button>
      </form>
      <div className="adminTable">
        {users.map((user) => (
          <article className="adminTableRow" key={user.id}>
            <div>
              <Link href={`/admin/kullanicilar/${user.id}`}>
                <strong>{user.displayName ?? user.username}</strong>
              </Link>
              <small>
                @{user.username} · {user.email}
              </small>
            </div>
            <span>{user.accountStatus}</span>
            <span>{user.roles.map(({ role }) => role.code).join(", ")}</span>
            <span>
              {user._count.authoredPosts} yazı · {user._count.comments} yorum
            </span>
            <time>
              {user.lastLoginAt?.toLocaleString("tr-TR") ?? "Giriş yok"}
            </time>
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
