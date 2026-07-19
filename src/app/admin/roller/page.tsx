import { PageShell } from "@/components/page-shell";
import { SettingsForm } from "@/components/settings-form";
import { updateRoleAction } from "@/server/actions/admin-actions";
import { requirePermission } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";

export default async function RolesPage() {
  await requirePermission("roles.manage");
  const [roles, permissions, csrf] = await Promise.all([
    db.role.findMany({
      include: { permissions: true, _count: { select: { users: true } } },
      orderBy: { priority: "desc" },
    }),
    db.permission.findMany({ orderBy: { key: "asc" } }),
    createCsrfToken(),
  ]);
  return (
    <PageShell
      title="Rol ve permission yönetimi"
      description="ADMIN rolü güvenlik nedeniyle panelden daraltılamaz."
    >
      <div className="adminTable">
        {roles.map((role) =>
          role.code === "ADMIN" ? (
            <article className="settingsCard" key={role.id}>
              <h2>{role.name}</h2>
              <p>Tam yetki · {role._count.users} kullanıcı</p>
            </article>
          ) : (
            <SettingsForm
              key={role.id}
              action={updateRoleAction}
              csrf={csrf}
              submitLabel={`${role.name} rolünü güncelle`}
            >
              <input type="hidden" name="roleCode" value={role.code} />
              <h2>{role.name}</h2>
              <label>
                Renk
                <input name="color" type="color" defaultValue={role.color} />
              </label>
              <label>
                İkon
                <input
                  name="icon"
                  defaultValue={role.icon ?? ""}
                  maxLength={50}
                />
              </label>
              <fieldset>
                <legend>Yetkiler</legend>
                {permissions.map((permission) => (
                  <label key={permission.id}>
                    <input
                      type="checkbox"
                      name="permissionIds"
                      value={permission.id}
                      defaultChecked={role.permissions.some(
                        ({ permissionId }) => permissionId === permission.id,
                      )}
                    />
                    {permission.key}
                    <small>{permission.description}</small>
                  </label>
                ))}
              </fieldset>
              <small>{role._count.users} kullanıcı</small>
            </SettingsForm>
          ),
        )}
      </div>
    </PageShell>
  );
}
