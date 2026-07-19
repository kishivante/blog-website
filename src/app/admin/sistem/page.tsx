import { PageShell } from "@/components/page-shell";
import { requirePermission } from "@/server/authorization";
import { getSystemHealth } from "@/services/admin-service";
export const dynamic = "force-dynamic";
export default async function SystemPage() {
  await requirePermission("settings.manage");
  const health = await getSystemHealth();
  return (
    <PageShell
      title="Sistem durumu"
      description="Canlı bağımlılık ve kuyruk durumu."
    >
      <div className="systemGrid">
        <article className="settingsCard">
          <h2>PostgreSQL</h2>
          <p>Bağlantı başarılı · {health.postgres.latencyMs} ms</p>
        </article>
        <article className="settingsCard">
          <h2>Redis</h2>
          <p>Bağlantı başarılı · {health.redis.latencyMs} ms</p>
        </article>
        <article className="settingsCard">
          <h2>Storage</h2>
          <p>
            {health.storage.ok
              ? `${Math.round(health.storage.freeBytes / 1_048_576)} MB boş / ${Math.round(health.storage.totalBytes / 1_048_576)} MB`
              : "Storage yolu erişilemiyor"}
          </p>
        </article>
        <article className="settingsCard">
          <h2>Mail kuyruğu</h2>
          <p>
            {health.mail.pending} bekliyor · {health.mail.failed} başarısız
          </p>
        </article>
        <article className="settingsCard">
          <h2>Runtime</h2>
          <p>
            {health.nodeVersion} · uptime {health.uptimeSeconds} saniye
          </p>
        </article>
      </div>
    </PageShell>
  );
}
