import { PageShell } from "@/components/page-shell";
import { SettingsForm } from "@/components/settings-form";
import { EmptyState } from "@/components/ui/primitives";
import { requirePermission } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";
import { resolveReportAction } from "@/server/actions/report-actions";

export default async function Page() {
  await requirePermission("reports.manage");
  const reports = await db.report.findMany({
    where: { status: { in: ["OPEN", "IN_REVIEW"] } },
    include: { reporter: { select: { username: true } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const csrf = await createCsrfToken();
  return (
    <PageShell
      title="Raporlar"
      description="Kullanıcı ve içerik raporlarını inceleyip denetlenebilir kararlar verin."
    >
      {reports.length ? (
        <div className="reportQueue">
          {reports.map((report) => (
            <article className="settingsCard" key={report.id}>
              <header>
                <span className="uiBadge uiBadge--amber">
                  {report.targetType}
                </span>
                <h2>{report.reason}</h2>
                <p>
                  @{report.reporter.username} ·{" "}
                  {report.createdAt.toLocaleString("tr-TR")}
                </p>
              </header>
              <p>{report.details ?? "Açıklama eklenmedi."}</p>
              <SettingsForm
                action={resolveReportAction}
                csrf={csrf}
                submitLabel="Kararı kaydet"
              >
                <input type="hidden" name="reportId" value={report.id} />
                <label>
                  Durum
                  <select name="status">
                    <option value="RESOLVED">Çözüldü</option>
                    <option value="DISMISSED">Reddedildi</option>
                  </select>
                </label>
                <label>
                  Moderasyon işlemi
                  <select name="moderationAction">
                    <option value="">İşlem yok</option>
                    <option value="WARN">Uyar</option>
                    {report.targetType !== "USER" ? (
                      <>
                        <option value="HIDE">Gizle</option>
                        <option value="REMOVE">Kaldır</option>
                      </>
                    ) : (
                      <option value="SUSPEND">Askıya al</option>
                    )}
                  </select>
                </label>
                <label>
                  Karar ve gerekçe
                  <textarea
                    name="resolution"
                    minLength={5}
                    maxLength={2000}
                    required
                  />
                </label>
              </SettingsForm>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Açık rapor yok"
          description="Yeni raporlar burada görüntülenecek."
        />
      )}
    </PageShell>
  );
}
