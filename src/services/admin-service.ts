import "server-only";
import { statfs } from "node:fs/promises";
import type { AccountStatus, Prisma, RoleCode } from "@prisma/client";
import { db } from "@/server/db";
import { getRedis } from "@/server/redis";
import type { RequestContext } from "@/server/request-context";
import { assertLastAdminSafety } from "@/lib/admin-policy";

export async function getSystemHealth() {
  const started = performance.now();
  await db.$queryRaw`SELECT 1`;
  const postgresLatencyMs = Math.round(performance.now() - started);
  const redis = await getRedis();
  const redisStarted = performance.now();
  await redis.ping();
  const redisLatencyMs = Math.round(performance.now() - redisStarted);
  const storage = await statfs(
    process.env.UPLOAD_LOCAL_PATH ?? "/app/public/uploads",
  ).catch(() => null);
  const [mailPending, mailFailed] = await Promise.all([
    db.notification.count({ where: { emailStatus: "PENDING" } }),
    db.notification.count({ where: { emailStatus: "FAILED" } }),
  ]);
  return {
    postgres: { ok: true, latencyMs: postgresLatencyMs },
    redis: { ok: true, latencyMs: redisLatencyMs },
    storage: storage
      ? {
          ok: true,
          freeBytes: storage.bavail * storage.bsize,
          totalBytes: storage.blocks * storage.bsize,
        }
      : { ok: false, freeBytes: 0, totalBytes: 0 },
    mail: { pending: mailPending, failed: mailFailed },
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
  };
}

export async function updateUserAdministration(input: {
  actorId: string;
  userId: string;
  roleIds: string[];
  badgeIds: string[];
  status: AccountStatus;
  suspensionReason?: string;
  suspendedUntil?: Date;
  warning?: string;
  context: RequestContext;
}) {
  if (input.actorId === input.userId && input.status !== "ACTIVE")
    throw new Error("Kendi yönetici hesabınızı devre dışı bırakamazsınız.");
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      include: { roles: { include: { role: true } }, badges: true },
    });
    if (!user) throw new Error("Kullanıcı bulunamadı.");
    const adminRole = await tx.role.findUniqueOrThrow({
      where: { code: "ADMIN" },
    });
    const wasAdmin = user.roles.some(({ role }) => role.code === "ADMIN");
    const remainsAdmin =
      input.roleIds.includes(adminRole.id) && input.status === "ACTIVE";
    if (wasAdmin && !remainsAdmin) {
      const activeAdmins = await tx.user.count({
        where: {
          accountStatus: "ACTIVE",
          deletedAt: null,
          roles: { some: { role: { code: "ADMIN" } } },
        },
      });
      assertLastAdminSafety({
        wasAdmin,
        remainsActiveAdmin: remainsAdmin,
        activeAdminCount: activeAdmins,
      });
    }
    await tx.userRole.deleteMany({ where: { userId: user.id } });
    if (input.roleIds.length)
      await tx.userRole.createMany({
        data: input.roleIds.map((roleId) => ({
          userId: user.id,
          roleId,
          assignedBy: input.actorId,
        })),
        skipDuplicates: true,
      });
    await tx.userBadge.deleteMany({ where: { userId: user.id } });
    if (input.badgeIds.length)
      await tx.userBadge.createMany({
        data: input.badgeIds.map((badgeId) => ({
          userId: user.id,
          badgeId,
          awardedBy: input.actorId,
        })),
        skipDuplicates: true,
      });
    await tx.user.update({
      where: { id: user.id },
      data: {
        accountStatus: input.status,
        suspendedAt: input.status === "SUSPENDED" ? new Date() : null,
        suspendedUntil:
          input.status === "SUSPENDED" ? input.suspendedUntil : null,
        suspensionReason:
          input.status === "SUSPENDED" ? input.suspensionReason : null,
      },
    });
    await tx.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokedReason: "Yönetim yetkileri veya hesap durumu değiştirildi.",
      },
    });
    if (input.warning?.trim()) {
      await tx.notification.create({
        data: {
          type: "MODERATION",
          recipientId: user.id,
          senderId: input.actorId,
          title: "Yönetim uyarısı",
          message: input.warning.trim(),
        },
      });
      await tx.moderationAction.create({
        data: {
          actorId: input.actorId,
          action: "WARN",
          targetType: "USER",
          targetId: user.id,
          reason: input.warning.trim(),
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "USER_ADMINISTRATION_UPDATED",
        targetType: "User",
        targetId: user.id,
        previousValue: {
          status: user.accountStatus,
          roles: user.roles.map(({ role }) => role.code),
          badges: user.badges.map(({ badgeId }) => badgeId),
        },
        newValue: {
          status: input.status,
          roleIds: input.roleIds,
          badgeIds: input.badgeIds,
          suspendedUntil: input.suspendedUntil,
          reason: input.suspensionReason,
        },
        ipAddress: input.context.ip,
        userAgent: input.context.userAgent,
      },
    });
  });
}

export async function updateRolePermissions(input: {
  actorId: string;
  roleCode: RoleCode;
  permissionIds: string[];
  color: string;
  icon?: string;
  context: RequestContext;
}) {
  if (input.roleCode === "ADMIN")
    throw new Error("ADMIN rolünün tam yetki kümesi panelden daraltılamaz.");
  await db.$transaction(async (tx) => {
    const role = await tx.role.findUniqueOrThrow({
      where: { code: input.roleCode },
      include: { permissions: true },
    });
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (input.permissionIds.length)
      await tx.rolePermission.createMany({
        data: input.permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    await tx.role.update({
      where: { id: role.id },
      data: { color: input.color, icon: input.icon || null },
    });
    await tx.session.updateMany({
      where: {
        user: { roles: { some: { roleId: role.id } } },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: "Rol yetkileri değiştirildi.",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "ROLE_PERMISSIONS_UPDATED",
        targetType: "Role",
        targetId: role.id,
        previousValue: {
          permissionIds: role.permissions.map(
            ({ permissionId }) => permissionId,
          ),
          color: role.color,
        },
        newValue: { permissionIds: input.permissionIds, color: input.color },
        ipAddress: input.context.ip,
        userAgent: input.context.userAgent,
      },
    });
  });
}

export async function writeAdminAudit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | undefined,
  previousValue: Prisma.InputJsonValue | undefined,
  newValue: Prisma.InputJsonValue | undefined,
  context: RequestContext,
) {
  await db.auditLog.create({
    data: {
      actorId,
      action,
      targetType,
      targetId,
      previousValue,
      newValue,
      ipAddress: context.ip,
      userAgent: context.userAgent,
    },
  });
}
