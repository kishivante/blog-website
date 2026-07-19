import Link from "next/link";
import type { SecurityEventType, SecuritySeverity } from "@prisma/client";
import { PageShell } from "@/components/page-shell";
import { requirePermission } from "@/server/authorization";
import { db } from "@/server/db";

export default async function SecurityAdmin({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; severity?: string }>;
}) {
  await requirePermission("security.manage");
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const take = 40;
  const types = [
    "LOGIN_FAILED",
    "PASSWORD_CHANGED",
    "TWO_FACTOR_ENABLED",
    "TWO_FACTOR_DISABLED",
    "OAUTH_LINKED",
    "OAUTH_UNLINKED",
    "SESSION_REVOKED",
    "PERMISSION_CHANGED",
    "SUSPICIOUS_UPLOAD",
    "RATE_LIMIT_VIOLATION",
  ] as const;
  const severities = ["INFO", "WARNING", "CRITICAL"] as const;
  const type = types.includes(query.type as SecurityEventType)
    ? (query.type as SecurityEventType)
    : undefined;
  const severity = severities.includes(query.severity as SecuritySeverity)
    ? (query.severity as SecuritySeverity)
    : undefined;
  const where = {
    ...(type ? { type } : {}),
    ...(severity ? { severity } : {}),
  };
  const [events, total] = await Promise.all([
    db.securityEvent.findMany({
      where,
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    db.securityEvent.count({ where }),
  ]);
  return (
    <PageShell
      title="Güvenlik yönetimi"
      description={`${total} güvenlik olayı.`}
    >
      <form className="adminFilters">
        <select name="type" defaultValue={type ?? ""}>
          <option value="">Tüm türler</option>
          {types.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select name="severity" defaultValue={severity ?? ""}>
          <option value="">Tüm önem seviyeleri</option>
          {severities.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button className="uiButton">Filtrele</button>
      </form>
      <div className="adminTable">
        {events.map((event) => (
          <article className="adminTableRow" key={event.id}>
            <strong>{event.type}</strong>
            <span>{event.severity}</span>
            <span>@{event.user?.username ?? "anonim"}</span>
            <span>{event.ipAddress ?? "IP yok"}</span>
            <time>{event.createdAt.toLocaleString("tr-TR")}</time>
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
