"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { requireUser } from "@/server/authorization";
import { assertCsrfToken } from "@/server/csrf";
import { getRequestContext } from "@/server/request-context";
import { enforceRateLimit } from "@/server/rate-limit";
import { storeProfileImage } from "@/services/upload-service";
import {
  appearanceSchema,
  criticalActionSchema,
  emailChangeSchema,
  notificationSettingsSchema,
  passwordChangeSchema,
  privacySchema,
  profileSchema,
  usernameChangeSchema,
} from "@/validators/profile";
import {
  changePassword,
  changeUsername,
  confirmEmailChange,
  requestAccountDeletion,
  assertUserCanDisable,
  requestEmailChange,
  setBlock,
  setFollow,
  updateProfile,
  verifyCritical,
} from "@/services/profile-service";
import type { FormState } from "@/types/forms";

const values = (form: FormData) => Object.fromEntries(form);
const checked = (form: FormData, name: string) => form.get(name) === "on";
const errorState = (error: unknown): FormState => ({
  error: error instanceof Error ? error.message : "İşlem tamamlanamadı.",
});

export async function updateProfileAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requireUser();
    const parsed = profileSchema.safeParse(values(form));
    if (!parsed.success)
      return {
        error: "Profil alanlarını kontrol edin.",
        fields: parsed.error.flatten().fieldErrors,
      };
    await updateProfile(session.userId, parsed.data, await getRequestContext());
    revalidatePath(`/kullanici/${session.user.username}`);
    return { success: "Profil bilgileriniz güncellendi." };
  } catch (error) {
    return errorState(error);
  }
}

export async function updateProfileImagesAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requireUser();
    const context = await getRequestContext();
    await enforceRateLimit("upload", context.ip, session.userId);
    const avatar = form.get("avatar");
    const cover = form.get("cover");
    const data: { avatar?: string; profileCover?: string } = {};
    if (avatar instanceof File && avatar.size)
      data.avatar = await storeProfileImage(
        avatar,
        session.userId,
        "avatar",
        context,
      );
    if (cover instanceof File && cover.size)
      data.profileCover = await storeProfileImage(
        cover,
        session.userId,
        "cover",
        context,
      );
    if (!data.avatar && !data.profileCover)
      return { error: "Yüklenecek bir görsel seçin." };
    await db.user.update({ where: { id: session.userId }, data });
    await db.auditLog.create({
      data: {
        actorId: session.userId,
        action: "PROFILE_IMAGES_UPDATED",
        targetType: "User",
        targetId: session.userId,
        newValue: data,
        ipAddress: context.ip,
        userAgent: context.userAgent,
      },
    });
    revalidatePath(`/kullanici/${session.user.username}`);
    return { success: "Profil görselleri güncellendi." };
  } catch (error) {
    return errorState(error);
  }
}

export async function updateAppearanceAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requireUser();
    const parsed = appearanceSchema.safeParse(values(form));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message };
    await db.user.update({
      where: { id: session.userId },
      data: {
        profileAccent: parsed.data.profileAccent,
        profileLayoutSettings: { layout: parsed.data.layout },
      },
    });
    revalidatePath(`/kullanici/${session.user.username}`);
    return { success: "Görünüm tercihleriniz kaydedildi." };
  } catch (error) {
    return errorState(error);
  }
}

export async function updatePrivacyAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requireUser();
    const parsed = privacySchema.parse({
      profileVisibility: form.get("profileVisibility"),
      showFollowers: checked(form, "showFollowers"),
      showFollowing: checked(form, "showFollowing"),
      showCommentHistory: checked(form, "showCommentHistory"),
      showWikiContributions: checked(form, "showWikiContributions"),
      showOnlineStatus: checked(form, "showOnlineStatus"),
    });
    const { profileVisibility, ...privacySettings } = parsed;
    await db.$transaction([
      db.user.update({
        where: { id: session.userId },
        data: { profileVisibility },
      }),
      db.userPrivacySetting.upsert({
        where: { userId: session.userId },
        create: { userId: session.userId, ...privacySettings },
        update: privacySettings,
      }),
    ]);
    revalidatePath(`/kullanici/${session.user.username}`);
    return { success: "Gizlilik ayarları güncellendi." };
  } catch (error) {
    return errorState(error);
  }
}

export async function updateNotificationsAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requireUser();
    const parsed = notificationSettingsSchema.parse(
      Object.fromEntries(
        [
          "emailEnabled",
          "securityEmail",
          "commentNotifications",
          "replyNotifications",
          "followerNotifications",
          "reviewNotifications",
          "marketingEmail",
        ].map((name) => [name, checked(form, name)]),
      ),
    );
    await db.userNotificationSetting.upsert({
      where: { userId: session.userId },
      create: { userId: session.userId, ...parsed },
      update: parsed,
    });
    return { success: "Bildirim tercihleri güncellendi." };
  } catch (error) {
    return errorState(error);
  }
}

export async function changeUsernameAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requireUser();
    const parsed = usernameChangeSchema.safeParse(values(form));
    if (!parsed.success)
      return {
        error: "Kullanıcı adı veya parola geçersiz.",
        fields: parsed.error.flatten().fieldErrors,
      };
    await changeUsername(
      session.userId,
      parsed.data.username,
      parsed.data.password,
      await getRequestContext(),
    );
    return {
      success:
        "Kullanıcı adınız güncellendi; eski bağlantılar yeni profilinize yönlendirilecek.",
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function changePasswordAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requireUser();
    const parsed = passwordChangeSchema.safeParse({
      ...values(form),
      revokeOthers: checked(form, "revokeOthers"),
    });
    if (!parsed.success)
      return {
        error: "Parola alanlarını kontrol edin.",
        fields: parsed.error.flatten().fieldErrors,
      };
    await changePassword(
      session.userId,
      parsed.data.currentPassword,
      parsed.data.newPassword,
      parsed.data.revokeOthers,
      session.id,
      await getRequestContext(),
    );
    return { success: "Parolanız güncellendi." };
  } catch (error) {
    return errorState(error);
  }
}

export async function requestEmailChangeAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requireUser();
    const parsed = emailChangeSchema.safeParse(values(form));
    if (!parsed.success)
      return {
        error: "E-posta veya parola geçersiz.",
        fields: parsed.error.flatten().fieldErrors,
      };
    await requestEmailChange(
      session.userId,
      parsed.data.email,
      parsed.data.password,
      await getRequestContext(),
    );
    return {
      success:
        "Onay bağlantıları eski ve yeni e-posta adreslerinize gönderildi.",
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function confirmEmailChangeAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requireUser();
    await confirmEmailChange(
      session.userId,
      String(form.get("token") ?? ""),
      await getRequestContext(),
    );
    return {
      success:
        "Bu e-posta adresi onaylandı. Değişiklik iki adres de onaylandığında tamamlanır.",
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function followAction(form: FormData): Promise<void> {
  await assertCsrfToken(form.get("_csrf"));
  const session = await requireUser();
  const targetId = String(form.get("targetId") ?? "");
  await setFollow(
    session.userId,
    targetId,
    form.get("intent") === "follow",
    await getRequestContext(),
  );
  revalidatePath(String(form.get("path") ?? "/"));
}

export async function blockAction(form: FormData): Promise<void> {
  await assertCsrfToken(form.get("_csrf"));
  const session = await requireUser();
  const targetId = String(form.get("targetId") ?? "");
  await setBlock(
    session.userId,
    targetId,
    form.get("intent") === "block",
    await getRequestContext(),
  );
  revalidatePath(String(form.get("path") ?? "/"));
}

export async function requestDeletionAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requireUser();
    const parsed = criticalActionSchema.parse(values(form));
    await verifyCritical(session.userId, parsed.password, parsed.totp);
    await requestAccountDeletion(session.userId, await getRequestContext());
  } catch (error) {
    return errorState(error);
  }
  redirect("/giris");
}

export async function deactivateAccountAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requireUser();
    const parsed = criticalActionSchema.parse(values(form));
    await verifyCritical(session.userId, parsed.password, parsed.totp);
    await assertUserCanDisable(session.userId);
    const context = await getRequestContext();
    await db.$transaction([
      db.user.update({
        where: { id: session.userId },
        data: { accountStatus: "DISABLED" },
      }),
      db.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "account_disabled" },
      }),
      db.auditLog.create({
        data: {
          actorId: session.userId,
          action: "ACCOUNT_DISABLED",
          targetType: "User",
          targetId: session.userId,
          ipAddress: context.ip,
          userAgent: context.userAgent,
        },
      }),
    ]);
  } catch (error) {
    return errorState(error);
  }
  redirect("/giris");
}
