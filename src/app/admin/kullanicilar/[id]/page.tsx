import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { SettingsForm } from "@/components/settings-form";
import { updateUserAdminAction } from "@/server/actions/admin-actions";
import { requirePermission } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";

export default async function AdminUserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("users.manage");
  const permissions = new Set(
    session.user.roles.flatMap(({ role }) =>
      role.permissions.map(({ permission }) => permission.key),
    ),
  );
  const { id } = await params;
  const [user, roles, badges, moderation, csrf] = await Promise.all([
    db.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
        badges: { include: { badge: true } },
        sessions: { orderBy: { lastUsedAt: "desc" }, take: 20 },
        _count: {
          select: {
            authoredPosts: true,
            comments: true,
            followers: true,
            following: true,
          },
        },
      },
    }),
    db.role.findMany({ orderBy: { priority: "desc" } }),
    db.badge.findMany({ orderBy: { sortOrder: "asc" } }),
    db.moderationAction.findMany({
      where: { targetType: "USER", targetId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: { select: { username: true } } },
    }),
    createCsrfToken(),
  ]);
  if (!user) notFound();
  return (
    <PageShell
      title={user.displayName ?? user.username}
      description={`@${user.username} · ${user.email}`}
    >
      <div className="adminDetailGrid">
        <section className="settingsCard">
          <h2>Hesap özeti</h2>
          <p>Durum: {user.accountStatus}</p>
          <p>
            E-posta doğrulama:{" "}
            {user.emailVerifiedAt?.toLocaleString("tr-TR") ?? "Doğrulanmadı"}
          </p>
          <p>Son giriş: {user.lastLoginAt?.toLocaleString("tr-TR") ?? "Yok"}</p>
          <p>
            {user._count.authoredPosts} yazı · {user._count.comments} yorum ·{" "}
            {user._count.followers} takipçi
          </p>
          {user.suspensionReason ? (
            <p>
              Uzaklaştırma: {user.suspensionReason} ·{" "}
              {user.suspendedUntil?.toLocaleString("tr-TR") ?? "süresiz"}
            </p>
          ) : null}
        </section>
        <SettingsForm
          action={updateUserAdminAction}
          csrf={csrf}
          submitLabel="Kullanıcıyı güncelle"
        >
          <input type="hidden" name="userId" value={user.id} />
          <label>
            Hesap durumu
            <select name="status" defaultValue={user.accountStatus}>
              <option value="PENDING_VERIFICATION">Doğrulama bekliyor</option>
              <option value="ACTIVE">Aktif</option>
              <option value="SUSPENDED">Geçici uzaklaştırılmış</option>
              <option value="DISABLED">Kalıcı devre dışı</option>
              <option value="DELETED">Silinmiş</option>
            </select>
          </label>
          <label>
            Uzaklaştırma bitişi
            <input
              type="datetime-local"
              name="suspendedUntil"
              defaultValue={user.suspendedUntil?.toISOString().slice(0, 16)}
            />
          </label>
          <label>
            Neden
            <textarea
              name="suspensionReason"
              defaultValue={user.suspensionReason ?? ""}
              maxLength={1000}
            />
          </label>
          <label>
            Yeni uyarı
            <textarea name="warning" maxLength={1000} />
          </label>
          {permissions.has("roles.manage") ? (
            <fieldset>
              <legend>Roller</legend>
              {roles.map((role) => (
                <label key={role.id}>
                  <input
                    type="checkbox"
                    name="roleIds"
                    value={role.id}
                    defaultChecked={user.roles.some(
                      ({ roleId }) => roleId === role.id,
                    )}
                  />
                  {role.name}
                </label>
              ))}
            </fieldset>
          ) : null}
          {permissions.has("badges.manage") ? (
            <fieldset>
              <legend>Rozetler</legend>
              {badges.map((badge) => (
                <label key={badge.id}>
                  <input
                    type="checkbox"
                    name="badgeIds"
                    value={badge.id}
                    defaultChecked={user.badges.some(
                      ({ badgeId }) => badgeId === badge.id,
                    )}
                  />
                  {badge.name}
                </label>
              ))}
            </fieldset>
          ) : null}
        </SettingsForm>
      </div>
      <section className="settingsCard">
        <h2>Aktif ve son oturumlar</h2>
        {user.sessions.map((session) => (
          <p key={session.id}>
            {session.userAgent ?? "Bilinmeyen cihaz"} ·{" "}
            {session.ipAddress ?? "IP yok"} ·{" "}
            {session.lastUsedAt.toLocaleString("tr-TR")} ·{" "}
            {session.revokedAt
              ? "iptal"
              : session.expiresAt > new Date()
                ? "aktif"
                : "süresi dolmuş"}
          </p>
        ))}
      </section>
      <section className="settingsCard">
        <h2>Moderasyon geçmişi</h2>
        {moderation.length ? (
          moderation.map((action) => (
            <p key={action.id}>
              {action.action} · @{action.actor.username} · {action.reason} ·{" "}
              {action.createdAt.toLocaleString("tr-TR")}
            </p>
          ))
        ) : (
          <p>Kayıt yok.</p>
        )}
      </section>
    </PageShell>
  );
}
