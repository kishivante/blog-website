import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { requirePermission } from "@/server/authorization";
import { db } from "@/server/db";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("audit.read");
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const take = 50;
  const where = {
    ...(query.action
      ? { action: { contains: query.action, mode: "insensitive" as const } }
      : {}),
    ...(query.actor
      ? {
          actor: {
            username: { contains: query.actor, mode: "insensitive" as const },
          },
        }
      : {}),
    ...(query.target
      ? { targetType: { contains: query.target, mode: "insensitive" as const } }
      : {}),
  };
  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { actor: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    db.auditLog.count({ where }),
  ]);
  return (
    <PageShell
      title="Denetim kayıtları"
      description="Kayıtlar değiştirilemez ve bu arayüzden silinemez."
    >
      <form className="adminFilters">
        <input name="actor" defaultValue={query.actor} placeholder="Actor" />
        <input name="action" defaultValue={query.action} placeholder="Action" />
        <input
          name="target"
          defaultValue={query.target}
          placeholder="Target type"
        />
        <button className="uiButton">Filtrele</button>
      </form>
      <div className="auditTable">
        {logs.map((log) => (
          <details className="settingsCard" key={log.id}>
            <summary>
              <strong>{log.action}</strong> · @{log.actor?.username ?? "sistem"}{" "}
              · {log.targetType}:{log.targetId ?? "—"} ·{" "}
              {log.createdAt.toLocaleString("tr-TR")}
            </summary>
            <p>IP: {log.ipAddress ?? "—"}</p>
            <p>User-Agent: {log.userAgent ?? "—"}</p>
            <pre>
              {JSON.stringify(
                { previous: log.previousValue, next: log.newValue },
                null,
                2,
              )}
            </pre>
          </details>
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
