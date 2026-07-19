"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { assertCsrfToken } from "@/server/csrf";
import { enforceRateLimit } from "@/server/rate-limit";
import { getRequestContext } from "@/server/request-context";
import {
  createSession,
  getSession,
  revokeCurrentSession,
  revokeOtherSessions,
} from "@/server/session";
import { hashPassword, verifyPassword } from "@/server/password";
import { normalizeIdentity } from "@/lib/identity";
import { randomToken, sha256 } from "@/lib/crypto";
import { getRedis } from "@/server/redis";
import {
  loginSchema,
  passwordSchema,
  registrationSchema,
  tokenSchema,
  totpSchema,
} from "@/validators/auth";
import {
  consumeRecoveryCode,
  enableTwoFactor,
  verifyTotp,
} from "@/services/two-factor-service";
import {
  unlinkOAuthAccount,
  type OAuthProvider,
} from "@/services/oauth-service";
import {
  consumeVerificationToken,
  sendPasswordReset,
  sendVerificationEmail,
} from "@/services/token-service";
import type { FormState } from "@/types/forms";

const genericLoginError = "Giriş bilgileri doğrulanamadı.";

function fieldErrors(error: {
  flatten(): { fieldErrors: Record<string, string[]> };
}): FormState {
  return {
    error: "Lütfen işaretli alanları kontrol edin.",
    fields: error.flatten().fieldErrors,
  };
}

export async function registerAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(formData.get("_csrf"));
    const context = await getRequestContext();
    await enforceRateLimit("register", context.ip);
    const parsed = registrationSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fieldErrors(parsed.error);
    const normalizedEmail = normalizeIdentity(parsed.data.email);
    const normalizedUsername = normalizeIdentity(parsed.data.username);
    await enforceRateLimit("register", context.ip, normalizedEmail);
    const existing = await db.user.findFirst({
      where: { OR: [{ normalizedEmail }, { normalizedUsername }] },
      select: {
        id: true,
        email: true,
        normalizedEmail: true,
        emailVerifiedAt: true,
        deletedAt: true,
      },
    });
    if (existing) {
      if (
        existing.normalizedEmail === normalizedEmail &&
        !existing.emailVerifiedAt &&
        !existing.deletedAt
      )
        await sendVerificationEmail(existing.id, existing.email);
      return {
        success:
          "Kayıt isteğiniz alındı. Uygunsa doğrulama mesajı e-posta adresinize gönderilecektir.",
      };
    }
    const site = await db.siteSetting.findUnique({
      where: { id: "default" },
      select: { registrationEnabled: true },
    });
    if (site && !site.registrationEnabled)
      return { error: "Yeni hesap kaydı şu anda kapalı." };
    const userRole = await db.role.findUnique({ where: { code: "USER" } });
    if (!userRole) throw new Error("Varsayılan kullanıcı rolü bulunamadı.");
    const user = await db.user.create({
      data: {
        username: parsed.data.username,
        normalizedUsername,
        email: parsed.data.email,
        normalizedEmail,
        passwordHash: await hashPassword(parsed.data.password),
        privacySettings: { create: {} },
        notificationSettings: { create: {} },
        roles: { create: { roleId: userRole.id } },
      },
    });
    await sendVerificationEmail(user.id, user.email);
    return {
      success:
        "Kayıt tamamlandı. E-posta adresinize gönderilen doğrulama bağlantısını kullanın.",
    };
  } catch (error: unknown) {
    console.error(
      "register_failed",
      error instanceof Error ? error.message : "unknown",
    );
    return {
      error: "Kayıt şu anda tamamlanamadı. Lütfen daha sonra tekrar deneyin.",
    };
  }
}

export async function loginAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(formData.get("_csrf"));
    const context = await getRequestContext();
    const parsed = loginSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fieldErrors(parsed.error);
    const identity = normalizeIdentity(parsed.data.identity);
    await enforceRateLimit("login", context.ip, identity);
    const user = await db.user.findFirst({
      where: {
        OR: [{ normalizedEmail: identity }, { normalizedUsername: identity }],
      },
      include: { twoFactor: true },
    });
    const valid = await verifyPassword(
      user?.passwordHash ?? null,
      parsed.data.password,
    );
    await db.loginAttempt.create({
      data: {
        userId: user?.id,
        normalizedIdentity: identity,
        ipAddress: context.ip,
        userAgent: context.userAgent,
        successful: Boolean(valid && user),
        failureReason: valid ? null : "invalid_credentials",
      },
    });
    const suspensionExpired =
      user?.accountStatus === "SUSPENDED" &&
      user.suspendedUntil &&
      user.suspendedUntil <= new Date();
    if (user && suspensionExpired) {
      await db.user.update({
        where: { id: user.id },
        data: {
          accountStatus: "ACTIVE",
          suspendedAt: null,
          suspendedUntil: null,
          suspensionReason: null,
        },
      });
      user.accountStatus = "ACTIVE";
      user.suspendedAt = null;
      user.suspendedUntil = null;
      user.suspensionReason = null;
    }
    if (
      !user ||
      !valid ||
      user.accountStatus === "SUSPENDED" ||
      user.accountStatus === "DELETED" ||
      user.deletedAt
    )
      return { error: genericLoginError };
    if (user.accountStatus === "DISABLED") {
      await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: { accountStatus: "ACTIVE" },
        }),
        db.accountDeletionRequest.updateMany({
          where: { userId: user.id, completedAt: null, cancelledAt: null },
          data: { cancelledAt: new Date() },
        }),
        db.auditLog.create({
          data: {
            actorId: user.id,
            action: "ACCOUNT_REACTIVATED",
            targetType: "User",
            targetId: user.id,
            ipAddress: context.ip,
            userAgent: context.userAgent,
          },
        }),
      ]);
    }
    const trustedToken = (await cookies()).get("__Host-scarlet_trusted")?.value;
    const trustedDevice = trustedToken
      ? await db.trustedDevice.findUnique({
          where: { tokenHash: sha256(trustedToken) },
        })
      : null;
    const trusted = Boolean(
      trustedDevice &&
      trustedDevice.userId === user.id &&
      !trustedDevice.revokedAt &&
      trustedDevice.expiresAt > new Date(),
    );
    if (trustedDevice && trusted)
      await db.trustedDevice.update({
        where: { id: trustedDevice.id },
        data: { lastUsedAt: new Date(), ipAddress: context.ip },
      });
    if (user.twoFactor?.enabledAt && !trusted) {
      const challenge = randomToken();
      await (
        await getRedis()
      ).set(
        `2fa:${sha256(challenge)}`,
        JSON.stringify({ userId: user.id, context }),
        { EX: 300 },
      );
      (await cookies()).set("__Host-scarlet_2fa", challenge, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 300,
      });
      redirect("/iki-adimli-dogrulama");
    }
    await createSession(user.id, context);
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT")
      throw error;
    console.error(
      "login_failed",
      error instanceof Error ? error.message : "unknown",
    );
    return { error: genericLoginError };
  }
  redirect("/");
}

export async function completeTwoFactorAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(formData.get("_csrf"));
    const context = await getRequestContext();
    const token = String(formData.get("code") ?? "").trim();
    if (!/^\d{6}$/.test(token) && !/^[A-Z0-9_-]{10,32}$/i.test(token))
      return { error: "Doğrulama veya kurtarma kodu geçersiz." };
    await enforceRateLimit("two-factor", context.ip);
    const store = await cookies();
    const challenge = store.get("__Host-scarlet_2fa")?.value;
    if (!challenge) return { error: "Giriş doğrulamasının süresi doldu." };
    const redis = await getRedis();
    const raw = await redis.getDel(`2fa:${sha256(challenge)}`);
    if (!raw) return { error: "Giriş doğrulamasının süresi doldu." };
    const pending = JSON.parse(raw) as { userId: string };
    const valid =
      (await verifyTotp(pending.userId, token)) ||
      (await consumeRecoveryCode(pending.userId, token));
    if (!valid) return { error: "Doğrulama kodu geçersiz." };
    store.delete("__Host-scarlet_2fa");
    await createSession(pending.userId, context);
    if (formData.get("trustDevice") === "on") {
      const trustedToken = randomToken();
      await db.trustedDevice.create({
        data: {
          userId: pending.userId,
          tokenHash: sha256(trustedToken),
          name: context.userAgent.slice(0, 120),
          ipAddress: context.ip,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      store.set("__Host-scarlet_trusted", trustedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    await db.user.update({
      where: { id: pending.userId },
      data: { lastLoginAt: new Date() },
    });
  } catch (error: unknown) {
    console.error(
      "two_factor_login_failed",
      error instanceof Error ? error.message : "unknown",
    );
    return { error: "Doğrulama tamamlanamadı." };
  }
  redirect("/");
}

export async function requestPasswordResetAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const response = {
    success:
      "Bu adres kullanılabilir bir hesaba aitse sıfırlama bağlantısı gönderildi.",
  };
  try {
    await assertCsrfToken(formData.get("_csrf"));
    const context = await getRequestContext();
    const identity = normalizeIdentity(String(formData.get("email") ?? ""));
    await enforceRateLimit("password-reset", context.ip, identity);
    const user = await db.user.findUnique({
      where: { normalizedEmail: identity },
    });
    if (user && !user.deletedAt) await sendPasswordReset(user.id, user.email);
  } catch (error: unknown) {
    console.error(
      "password_reset_request_failed",
      error instanceof Error ? error.message : "unknown",
    );
  }
  return response;
}

export async function resetPasswordAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(formData.get("_csrf"));
    const token = tokenSchema.safeParse(formData.get("token"));
    const password = passwordSchema.safeParse(formData.get("password"));
    if (!token.success || !password.success)
      return { error: "Bağlantı veya parola geçersiz." };
    const record = await db.passwordResetToken.findUnique({
      where: { tokenHash: sha256(token.data) },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date())
      return { error: "Bağlantı geçersiz veya süresi dolmuş." };
    const passwordHash = await hashPassword(password.data);
    const reset = await db.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id: record.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) return false;
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
      await tx.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "password_reset" },
      });
      return true;
    });
    if (!reset) return { error: "Bağlantı daha önce kullanılmış." };
    return {
      success: "Parolanız yenilendi. Yeni parolanızla giriş yapabilirsiniz.",
    };
  } catch {
    return { error: "Parola sıfırlanamadı." };
  }
}

export async function verifyEmailAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(formData.get("_csrf"));
    const context = await getRequestContext();
    await enforceRateLimit("verify-email", context.ip);
    const token = tokenSchema.safeParse(formData.get("token"));
    if (!token.success || !(await consumeVerificationToken(token.data)))
      return { error: "Doğrulama bağlantısı geçersiz veya süresi dolmuş." };
    return { success: "E-posta adresiniz doğrulandı." };
  } catch {
    return { error: "E-posta doğrulanamadı." };
  }
}

export async function logoutAction(formData: FormData): Promise<void> {
  await assertCsrfToken(formData.get("_csrf"));
  await revokeCurrentSession();
  redirect("/giris");
}

export async function revokeOtherSessionsAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrfToken(formData.get("_csrf"));
  const session = await getSession();
  if (!session) return { error: "Oturum bulunamadı." };
  const count = await revokeOtherSessions(session.userId, session.id);
  return { success: `${count} diğer oturum kapatıldı.` };
}

export async function revokeTrustedDeviceAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrfToken(formData.get("_csrf"));
  const session = await getSession();
  if (!session) return { error: "Oturum bulunamadı." };
  const deviceId = String(formData.get("deviceId") ?? "");
  const result = await db.trustedDevice.updateMany({
    where: { id: deviceId, userId: session.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count
    ? { success: "Güvenilir cihaz kaldırıldı." }
    : { error: "Cihaz bulunamadı." };
}

export async function enableTwoFactorAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrfToken(formData.get("_csrf"));
  const session = await getSession();
  if (!session) return { error: "Oturum bulunamadı." };
  const parsed = totpSchema.safeParse(formData.get("code"));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Kod geçersiz." };
  try {
    const codes = await enableTwoFactor(session.userId, parsed.data);
    await db.auditLog.create({
      data: {
        actorId: session.userId,
        action: "TWO_FACTOR_ENABLED",
        targetType: "User",
        targetId: session.userId,
      },
    });
    return {
      success: `2FA etkinleştirildi. Kurtarma kodları: ${codes.join(" ")}`,
    };
  } catch (error: unknown) {
    return {
      error: error instanceof Error ? error.message : "2FA etkinleştirilemedi.",
    };
  }
}

export async function disableTwoFactorAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrfToken(formData.get("_csrf"));
  const session = await getSession();
  if (!session) return { error: "Oturum bulunamadı." };
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "");
  if (
    !(await verifyPassword(session.user.passwordHash, password)) ||
    !(await verifyTotp(session.userId, code))
  )
    return { error: "Parola veya doğrulama kodu geçersiz." };
  await db.$transaction([
    db.twoFactorCredential.delete({ where: { userId: session.userId } }),
    db.recoveryCode.deleteMany({ where: { userId: session.userId } }),
    db.auditLog.create({
      data: {
        actorId: session.userId,
        action: "TWO_FACTOR_DISABLED",
        targetType: "User",
        targetId: session.userId,
      },
    }),
  ]);
  return { success: "İki adımlı doğrulama devre dışı bırakıldı." };
}

export async function unlinkOAuthAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrfToken(formData.get("_csrf"));
  const session = await getSession();
  if (!session) return { error: "Oturum bulunamadı." };
  const providerValue = formData.get("provider");
  if (providerValue !== "google" && providerValue !== "github")
    return { error: "Sağlayıcı geçersiz." };
  try {
    await unlinkOAuthAccount(session.userId, providerValue as OAuthProvider);
    await db.auditLog.create({
      data: {
        actorId: session.userId,
        action: "OAUTH_UNLINKED",
        targetType: "User",
        targetId: session.userId,
        newValue: { provider: providerValue },
      },
    });
    return { success: "Bağlı hesap ayrıldı." };
  } catch (error: unknown) {
    return {
      error: error instanceof Error ? error.message : "Hesap ayrılamadı.",
    };
  }
}
