import { redirect } from "next/navigation";
import { getSession } from "@/server/session";

export async function requireUser(options: { verified?: boolean } = {}) {
  const session = await getSession();
  if (!session) redirect("/giris");
  if (options.verified !== false && !session.user.emailVerifiedAt)
    redirect("/email-dogrula");
  return session;
}

export async function requirePermission(permission: string) {
  const session = await requireUser();
  const permissions = new Set(
    session.user.roles.flatMap(({ role }) =>
      role.permissions.map(({ permission: item }) => item.key),
    ),
  );
  if (!permissions.has(permission))
    throw new Error("Bu işlem için yetkiniz yok.");
  return session;
}

export function hasPermission(
  keys: readonly string[],
  required: string,
): boolean {
  return keys.includes(required);
}

export async function requireApiPermission(permission: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, status: 401 };
  if (!session.user.emailVerifiedAt) return { ok: false as const, status: 403 };
  const permissions = session.user.roles.flatMap(({ role }) =>
    role.permissions.map(({ permission: item }) => item.key),
  );
  if (!hasPermission(permissions, permission))
    return { ok: false as const, status: 403 };
  return { ok: true as const, session };
}
