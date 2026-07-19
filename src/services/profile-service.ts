import { db } from "@/server/db";
import { normalizeIdentity } from "@/lib/identity";
import { hashPassword, verifyPassword } from "@/server/password";
import { verifyTotp } from "@/services/two-factor-service";
import { randomToken, sha256 } from "@/lib/crypto";
import { sendActionEmail } from "@/server/mailer";
import { getServerEnv } from "@/lib/env";
import type { RequestContext } from "@/server/request-context";
import type { Prisma } from "@prisma/client";
import { createNotification } from "@/services/notification-service";
import { assertLastAdminSafety } from "@/lib/admin-policy";

const protectedNames = new Set([
  "admin",
  "administrator",
  "moderator",
  "editor",
  "support",
  "supporter",
  "scarlet",
  "scarletsatellite",
  "root",
  "system",
  "security",
]);
const canonical = (value: string) =>
  normalizeIdentity(value)
    .replace(/[._-]/g, "")
    .replace(
      /[01!|]/g,
      (char) => ({ "0": "o", "1": "i", "!": "i", "|": "i" })[char] ?? char,
    );

async function audit(
  userId: string,
  action: string,
  previousValue: Prisma.InputJsonValue | undefined,
  newValue: Prisma.InputJsonValue | undefined,
  context: RequestContext,
) {
  await db.auditLog.create({
    data: {
      actorId: userId,
      action,
      targetType: "User",
      targetId: userId,
      previousValue,
      newValue,
      ipAddress: context.ip,
      userAgent: context.userAgent,
    },
  });
}

export async function changeUsername(
  userId: string,
  username: string,
  password: string,
  context: RequestContext,
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, password)))
    throw new Error("Parola doğrulanamadı.");
  const normalizedUsername = normalizeIdentity(username);
  if (protectedNames.has(canonical(username)))
    throw new Error("Bu kullanıcı adı sistem tarafından rezerve edilmiştir.");
  const [existing, history, reservation] = await Promise.all([
    db.user.findUnique({ where: { normalizedUsername }, select: { id: true } }),
    db.usernameHistory.findUnique({
      where: { normalizedUsername },
      select: { id: true },
    }),
    db.usernameReservation.findUnique({ where: { normalizedUsername } }),
  ]);
  if (
    (existing && existing.id !== userId) ||
    history ||
    (reservation &&
      (!reservation.reservedUntil || reservation.reservedUntil > new Date()))
  )
    throw new Error("Bu kullanıcı adı kullanılamıyor.");
  if (normalizedUsername === user.normalizedUsername) return;
  await db.$transaction([
    db.usernameHistory.create({
      data: {
        userId,
        previousUsername: user.username,
        normalizedUsername: user.normalizedUsername,
      },
    }),
    db.user.update({
      where: { id: userId },
      data: { username, normalizedUsername },
    }),
    db.auditLog.create({
      data: {
        actorId: userId,
        action: "USERNAME_CHANGED",
        targetType: "User",
        targetId: userId,
        previousValue: { username: user.username },
        newValue: { username },
        ipAddress: context.ip,
        userAgent: context.userAgent,
      },
    }),
  ]);
}

export async function updateProfile(
  userId: string,
  data: {
    displayName: string;
    biography: string;
    location: string;
    website: string;
    locale: string;
    timezone: string;
  },
  context: RequestContext,
) {
  const before = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      displayName: true,
      biography: true,
      location: true,
      website: true,
      locale: true,
      timezone: true,
    },
  });
  await db.user.update({
    where: { id: userId },
    data: {
      ...data,
      displayName: data.displayName || null,
      biography: data.biography || null,
      location: data.location || null,
      website: data.website || null,
    },
  });
  await audit(userId, "PROFILE_UPDATED", before, data, context);
}

export async function setFollow(
  actorId: string,
  targetId: string,
  follow: boolean,
  context: RequestContext,
) {
  if (actorId === targetId) throw new Error("Kendinizi takip edemezsiniz.");
  const blocked = await db.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: actorId, blockedId: targetId },
        { blockerId: targetId, blockedId: actorId },
      ],
    },
  });
  if (blocked) throw new Error("Bu kullanıcıyla etkileşim kuramazsınız.");
  let created = false;
  await db.$transaction(async (tx) => {
    const existing = await tx.userFollow.findUnique({
      where: {
        followerId_followingId: { followerId: actorId, followingId: targetId },
      },
    });
    if (follow && !existing) {
      await tx.userFollow.create({
        data: { followerId: actorId, followingId: targetId },
      });
      await tx.user.update({
        where: { id: actorId },
        data: { followingCount: { increment: 1 } },
      });
      await tx.user.update({
        where: { id: targetId },
        data: { followerCount: { increment: 1 } },
      });
      created = true;
    } else if (!follow && existing) {
      await tx.userFollow.delete({
        where: {
          followerId_followingId: {
            followerId: actorId,
            followingId: targetId,
          },
        },
      });
      await tx.user.update({
        where: { id: actorId },
        data: { followingCount: { decrement: 1 } },
      });
      await tx.user.update({
        where: { id: targetId },
        data: { followerCount: { decrement: 1 } },
      });
    }
  });
  if (created)
    await createNotification({
      type: "FOLLOW",
      recipientId: targetId,
      senderId: actorId,
      objectType: "User",
      objectId: actorId,
      title: "Yeni takipçi",
      message: "Bir kullanıcı sizi takip etmeye başladı.",
      emailKey: "followerNotifications",
    });
  await audit(
    actorId,
    follow ? "USER_FOLLOWED" : "USER_UNFOLLOWED",
    undefined,
    { targetId },
    context,
  );
}

export async function setBlock(
  actorId: string,
  targetId: string,
  blocked: boolean,
  context: RequestContext,
) {
  if (actorId === targetId) throw new Error("Kendinizi engelleyemezsiniz.");
  await db.$transaction(async (tx) => {
    if (blocked) {
      await tx.userBlock.upsert({
        where: {
          blockerId_blockedId: { blockerId: actorId, blockedId: targetId },
        },
        create: { blockerId: actorId, blockedId: targetId },
        update: {},
      });
      const follows = await tx.userFollow.findMany({
        where: {
          OR: [
            { followerId: actorId, followingId: targetId },
            { followerId: targetId, followingId: actorId },
          ],
        },
      });
      for (const follow of follows) {
        await tx.userFollow.delete({
          where: {
            followerId_followingId: {
              followerId: follow.followerId,
              followingId: follow.followingId,
            },
          },
        });
        await tx.user.update({
          where: { id: follow.followerId },
          data: { followingCount: { decrement: 1 } },
        });
        await tx.user.update({
          where: { id: follow.followingId },
          data: { followerCount: { decrement: 1 } },
        });
      }
    } else {
      await tx.userBlock.deleteMany({
        where: { blockerId: actorId, blockedId: targetId },
      });
    }
  });
  await audit(
    actorId,
    blocked ? "USER_BLOCKED" : "USER_UNBLOCKED",
    undefined,
    { targetId },
    context,
  );
}

export async function verifyCritical(
  userId: string,
  password: string,
  totp: string,
) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: { twoFactor: true },
  });
  if (user.passwordHash && !(await verifyPassword(user.passwordHash, password)))
    throw new Error("Parola doğrulanamadı.");
  if (!user.passwordHash && !user.twoFactor?.enabledAt)
    throw new Error(
      "Bu işlem için önce bir parola veya 2FA giriş yöntemi yapılandırın.",
    );
  if (user.twoFactor?.enabledAt && !(await verifyTotp(userId, totp)))
    throw new Error("İki aşamalı doğrulama kodu geçersiz.");
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  revokeOthers: boolean,
  currentSessionId: string,
  context: RequestContext,
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, currentPassword)))
    throw new Error("Mevcut parola yanlış.");
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    }),
    ...(revokeOthers
      ? [
          db.session.updateMany({
            where: { userId, id: { not: currentSessionId }, revokedAt: null },
            data: { revokedAt: new Date(), revokedReason: "password_changed" },
          }),
        ]
      : []),
    db.auditLog.create({
      data: {
        actorId: userId,
        action: "PASSWORD_CHANGED",
        targetType: "User",
        targetId: userId,
        ipAddress: context.ip,
        userAgent: context.userAgent,
      },
    }),
  ]);
}

export async function requestEmailChange(
  userId: string,
  email: string,
  password: string,
  context: RequestContext,
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, password)))
    throw new Error("Parola doğrulanamadı.");
  const normalizedNewEmail = normalizeIdentity(email);
  if (
    await db.user.findUnique({ where: { normalizedEmail: normalizedNewEmail } })
  )
    throw new Error("Bu e-posta adresi kullanılamıyor.");
  const oldToken = randomToken();
  const newToken = randomToken();
  const request = await db.emailChangeRequest.create({
    data: {
      userId,
      newEmail: email,
      normalizedNewEmail,
      oldEmailTokenHash: sha256(oldToken),
      newEmailTokenHash: sha256(newToken),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const link = (token: string) =>
    new URL(
      `/ayarlar/hesap?emailToken=${encodeURIComponent(token)}`,
      getServerEnv().APP_URL,
    ).toString();
  await Promise.all([
    sendActionEmail({
      to: user.email,
      title: "E-posta değişikliğini onaylayın",
      message:
        "Hesabınızın e-posta adresini değiştirme isteğini eski adresinizden onaylayın.",
      actionUrl: link(oldToken),
      actionLabel: "Eski adresi onayla",
    }),
    sendActionEmail({
      to: email,
      title: "Yeni e-posta adresini doğrulayın",
      message: "Yeni e-posta adresini doğrulayın.",
      actionUrl: link(newToken),
      actionLabel: "Yeni adresi doğrula",
    }),
  ]);
  await audit(
    userId,
    "EMAIL_CHANGE_REQUESTED",
    { email: user.email },
    { requestId: request.id, email },
    context,
  );
}

export async function confirmEmailChange(
  userId: string,
  token: string,
  context: RequestContext,
) {
  const hash = sha256(token);
  const request = await db.emailChangeRequest.findFirst({
    where: {
      userId,
      completedAt: null,
      expiresAt: { gt: new Date() },
      OR: [{ oldEmailTokenHash: hash }, { newEmailTokenHash: hash }],
    },
  });
  if (!request) throw new Error("Bağlantı geçersiz veya süresi dolmuş.");
  const isOld = request.oldEmailTokenHash === hash;
  const updated = await db.emailChangeRequest.update({
    where: { id: request.id },
    data: isOld
      ? { oldEmailVerifiedAt: new Date() }
      : { newEmailVerifiedAt: new Date() },
  });
  if (
    (updated.oldEmailVerifiedAt || isOld) &&
    (updated.newEmailVerifiedAt || !isOld)
  ) {
    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: {
          email: request.newEmail,
          normalizedEmail: request.normalizedNewEmail,
          emailVerifiedAt: new Date(),
        },
      }),
      db.emailChangeRequest.update({
        where: { id: request.id },
        data: { completedAt: new Date() },
      }),
      db.auditLog.create({
        data: {
          actorId: userId,
          action: "EMAIL_CHANGED",
          targetType: "User",
          targetId: userId,
          newValue: { email: request.newEmail },
          ipAddress: context.ip,
          userAgent: context.userAgent,
        },
      }),
    ]);
  }
}

export async function requestAccountDeletion(
  userId: string,
  context: RequestContext,
) {
  await assertUserCanDisable(userId);
  const executeAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await db.accountDeletionRequest.create({ data: { userId, executeAt } });
  await db.user.update({
    where: { id: userId },
    data: { accountStatus: "DISABLED" },
  });
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: {
      revokedAt: new Date(),
      revokedReason: "account_deletion_requested",
    },
  });
  await audit(
    userId,
    "ACCOUNT_DELETION_REQUESTED",
    undefined,
    { executeAt: executeAt.toISOString() },
    context,
  );
}

export async function assertUserCanDisable(userId: string): Promise<void> {
  const [user, activeAdminCount] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    }),
    db.user.count({
      where: {
        accountStatus: "ACTIVE",
        deletedAt: null,
        roles: { some: { role: { code: "ADMIN" } } },
      },
    }),
  ]);
  assertLastAdminSafety({
    wasAdmin: user.roles.some(({ role }) => role.code === "ADMIN"),
    remainsActiveAdmin: false,
    activeAdminCount,
  });
}

export async function processDueAccountDeletions(): Promise<number> {
  const due = await db.accountDeletionRequest.findMany({
    where: {
      executeAt: { lte: new Date() },
      completedAt: null,
      cancelledAt: null,
    },
    select: { id: true, userId: true },
    take: 50,
  });
  let completed = 0;
  for (const request of due) {
    await assertUserCanDisable(request.userId);
    const suffix = request.userId.toLowerCase();
    const follows = await db.userFollow.findMany({
      where: {
        OR: [
          { followerId: request.userId },
          { followingId: request.userId },
        ],
      },
      select: { followerId: true, followingId: true },
    });
    const affectedUsers = new Set(
      follows.flatMap(({ followerId, followingId }) => [
        followerId,
        followingId,
      ]),
    );
    affectedUsers.delete(request.userId);
    await db.$transaction([
      db.session.updateMany({
        where: { userId: request.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "account_deleted" },
      }),
      db.oAuthAccount.deleteMany({ where: { userId: request.userId } }),
      db.recoveryCode.deleteMany({ where: { userId: request.userId } }),
      db.trustedDevice.deleteMany({ where: { userId: request.userId } }),
      db.twoFactorCredential.deleteMany({ where: { userId: request.userId } }),
      db.userRole.deleteMany({ where: { userId: request.userId } }),
      db.userBadge.deleteMany({ where: { userId: request.userId } }),
      db.userFollow.deleteMany({
        where: {
          OR: [
            { followerId: request.userId },
            { followingId: request.userId },
          ],
        },
      }),
      db.userBlock.deleteMany({
        where: {
          OR: [
            { blockerId: request.userId },
            { blockedId: request.userId },
          ],
        },
      }),
      db.user.update({
        where: { id: request.userId },
        data: {
          username: `deleted_${suffix}`,
          normalizedUsername: `deleted_${suffix}`,
          email: `${suffix}@deleted.invalid`,
          normalizedEmail: `${suffix}@deleted.invalid`,
          passwordHash: null,
          displayName: "Silinmiş kullanıcı",
          firstName: null,
          lastName: null,
          biography: null,
          location: null,
          website: null,
          avatar: null,
          profileCover: null,
          profileAccent: null,
          profileLayoutSettings: undefined,
          emailVerifiedAt: null,
          accountStatus: "DELETED",
          deletedAt: new Date(),
          followerCount: 0,
          followingCount: 0,
        },
      }),
      db.accountDeletionRequest.update({
        where: { id: request.id },
        data: { completedAt: new Date() },
      }),
      db.auditLog.create({
        data: {
          action: "ACCOUNT_DELETION_COMPLETED",
          targetType: "User",
          targetId: request.userId,
        },
      }),
    ]);
    for (const userId of affectedUsers) {
      const [followerCount, followingCount] = await Promise.all([
        db.userFollow.count({ where: { followingId: userId } }),
        db.userFollow.count({ where: { followerId: userId } }),
      ]);
      await db.user.update({
        where: { id: userId },
        data: { followerCount, followingCount },
      });
    }
    completed += 1;
  }
  return completed;
}

export async function processExpiredSuspensions(): Promise<number> {
  const expired = await db.user.findMany({
    where: {
      accountStatus: "SUSPENDED",
      suspendedUntil: { lte: new Date() },
      deletedAt: null,
    },
    select: { id: true },
    take: 100,
  });
  for (const user of expired) {
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          accountStatus: "ACTIVE",
          suspendedAt: null,
          suspendedUntil: null,
          suspensionReason: null,
        },
      }),
      db.auditLog.create({
        data: {
          action: "USER_SUSPENSION_EXPIRED",
          targetType: "User",
          targetId: user.id,
        },
      }),
    ]);
  }
  return expired.length;
}
