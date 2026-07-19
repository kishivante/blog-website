import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { requirePermission } from "@/server/authorization";
import { db } from "@/server/db";
import { getSystemHealth } from "@/services/admin-service";

export default async function AdminDashboard() {
  await requirePermission("admin.access");
  const sinceResult = await db.$queryRaw<Array<{ since: Date }>>`
    SELECT NOW() - INTERVAL '30 days' AS "since"
  `;
  const since = sinceResult[0]?.since;
  if (!since) throw new Error("Sistem zamanı okunamadı.");
  const [
    pendingPosts,
    reports,
    newUsers,
    publishedPosts,
    comments,
    securityEvents,
    audit,
    health,
  ] = await Promise.all([
    db.post.count({ where: { status: "PENDING_REVIEW", deletedAt: null } }),
    db.report.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    db.user.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
    db.post.count({ where: { status: "PUBLISHED", deletedAt: null } }),
    db.comment.count(),
    db.securityEvent.count({ where: { createdAt: { gte: since } } }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { username: true } } },
    }),
    getSystemHealth(),
  ]);
  const cards = [
    ["Bekleyen yazılar", pendingPosts, "/admin/yazilar?status=PENDING_REVIEW"],
    ["Açık raporlar", reports, "/admin/raporlar"],
    ["Yeni kullanıcılar (30 gün)", newUsers, "/admin/kullanicilar"],
    ["Yayınlanan yazılar", publishedPosts, "/admin/yazilar?status=PUBLISHED"],
    ["Toplam yorum", comments, "/admin/yorumlar"],
    ["Güvenlik olayları (30 gün)", securityEvents, "/admin/guvenlik"],
  ] as const;
  return (
    <PageShell
      title="Yönetim paneli"
      description="İçerik, topluluk ve altyapı durumunun canlı özeti."
    >
      <div className="adminMetricGrid">
        {cards.map(([label, value, href]) => (
          <Link className="metricCard" href={href} key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </Link>
        ))}
      </div>
      <section className="systemGrid">
        <article className="settingsCard">
          <h2>Sistem sağlığı</h2>
          <p>PostgreSQL: {health.postgres.latencyMs} ms</p>
          <p>Redis: {health.redis.latencyMs} ms</p>
          <p>
            Storage:{" "}
            {health.storage.ok
              ? `${Math.round(health.storage.freeBytes / 1_073_741_824)} GB boş`
              : "erişilemiyor"}
          </p>
          <p>
            Mail kuyruğu: {health.mail.pending} bekliyor · {health.mail.failed}{" "}
            başarısız
          </p>
        </article>
        <article className="settingsCard">
          <h2>Son denetim kayıtları</h2>
          <ol className="auditMini">
            {audit.map((item) => (
              <li key={item.id}>
                <strong>{item.action}</strong>
                <span>
                  {item.actor?.username ?? "sistem"} ·{" "}
                  {item.createdAt.toLocaleString("tr-TR")}
                </span>
              </li>
            ))}
          </ol>
        </article>
      </section>
    </PageShell>
  );
}
