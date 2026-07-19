import { db } from "@/server/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { getServerEnv } from "@/lib/env";
import { sendActionEmail } from "@/server/mailer";

export async function sendVerificationEmail(
  userId: string,
  email: string,
): Promise<void> {
  const token = randomToken();
  await db.emailVerificationToken.deleteMany({
    where: { userId, usedAt: null },
  });
  await db.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  await sendActionEmail({
    to: email,
    title: "E-posta adresinizi doğrulayın",
    message:
      "Scarlet Satellite hesabınızı etkinleştirmek için bağlantıyı kullanın.",
    actionLabel: "E-postamı doğrula",
    actionUrl: new URL(
      `/email-dogrula?token=${encodeURIComponent(token)}`,
      getServerEnv().APP_URL,
    ).toString(),
  });
}

export async function consumeVerificationToken(
  token: string,
): Promise<boolean> {
  const record = await db.emailVerificationToken.findUnique({
    where: { tokenHash: sha256(token) },
  });
  if (!record || record.usedAt || record.expiresAt <= new Date()) return false;
  return db.$transaction(async (tx) => {
    const consumed = await tx.emailVerificationToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) return false;
    await tx.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date(), accountStatus: "ACTIVE" },
    });
    return true;
  });
}

export async function sendPasswordReset(
  userId: string,
  email: string,
): Promise<void> {
  const token = randomToken();
  await db.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
  await db.passwordResetToken.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  await sendActionEmail({
    to: email,
    title: "Parolanızı sıfırlayın",
    message:
      "Parolanızı sıfırlamak için tek kullanımlık bağlantıyı kullanın. Bağlantı bir saat geçerlidir.",
    actionLabel: "Parolamı sıfırla",
    actionUrl: new URL(
      `/sifre-sifirla?token=${encodeURIComponent(token)}`,
      getServerEnv().APP_URL,
    ).toString(),
  });
}
