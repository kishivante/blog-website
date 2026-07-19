"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { requirePermission } from "@/server/authorization";
import { assertCsrfToken } from "@/server/csrf";
import { getRequestContext } from "@/server/request-context";
import { getRedis } from "@/server/redis";
import {
  updateRolePermissions,
  updateUserAdministration,
  writeAdminAudit,
} from "@/services/admin-service";
import type { FormState } from "@/types/forms";
import { enforceRateLimit } from "@/server/rate-limit";
import { storeImage } from "@/services/upload-service";
import {
  MAX_BASE_FONT_SIZE,
  MIN_BASE_FONT_SIZE,
  SITE_FONT_FAMILIES,
} from "@/lib/site-typography";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const failure = (error: unknown): FormState => ({
  error: error instanceof Error ? error.message : "İşlem tamamlanamadı.",
});
const text = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();

export async function saveTaxonomyAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requirePermission("taxonomy.manage");
    const kind = text(form, "kind");
    const id = text(form, "id");
    const data = {
      name: z.string().min(2).max(80).parse(text(form, "name")),
      slug: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .max(100)
        .parse(text(form, "slug")),
      description: z.string().max(500).parse(text(form, "description")) || null,
      color:
        color.optional().or(z.literal("")).parse(text(form, "color")) || null,
      icon: z.string().max(50).parse(text(form, "icon")) || null,
      active: form.get("active") === "on",
      sortOrder: z.coerce
        .number()
        .int()
        .min(0)
        .max(10000)
        .parse(form.get("sortOrder")),
    };
    const context = await getRequestContext();
    if (kind === "category") {
      const previous = id
        ? await db.category.findUnique({ where: { id } })
        : null;
      const parentId = text(form, "parentId") || null;
      if (id && parentId === id)
        throw new Error("Kategori kendisinin üst kategorisi olamaz.");
      const result = id
        ? await db.category.update({
            where: { id },
            data: { ...data, parentId },
          })
        : await db.category.create({ data: { ...data, parentId } });
      await writeAdminAudit(
        session.userId,
        id ? "CATEGORY_UPDATED" : "CATEGORY_CREATED",
        "Category",
        result.id,
        previous ?? undefined,
        result,
        context,
      );
    } else if (kind === "tag") {
      const previous = id ? await db.tag.findUnique({ where: { id } }) : null;
      const result = id
        ? await db.tag.update({ where: { id }, data })
        : await db.tag.create({ data });
      await writeAdminAudit(
        session.userId,
        id ? "TAG_UPDATED" : "TAG_CREATED",
        "Tag",
        result.id,
        previous ?? undefined,
        result,
        context,
      );
    } else throw new Error("Taksonomi türü geçersiz.");
    revalidatePath(
      kind === "category" ? "/admin/kategoriler" : "/admin/etiketler",
    );
    return { success: "Kayıt kaydedildi." };
  } catch (error) {
    return failure(error);
  }
}

export async function updateUserAdminAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requirePermission("users.manage");
    const permissions = new Set(
      session.user.roles.flatMap(({ role }) =>
        role.permissions.map(({ permission }) => permission.key),
      ),
    );
    const current = await db.user.findUniqueOrThrow({
      where: { id: text(form, "userId") },
      include: { roles: true, badges: true },
    });
    const until = text(form, "suspendedUntil");
    const suspendedUntil = until ? new Date(until) : undefined;
    if (suspendedUntil && Number.isNaN(suspendedUntil.getTime()))
      throw new Error("Uzaklaştırma tarihi geçersiz.");
    await updateUserAdministration({
      actorId: session.userId,
      userId: text(form, "userId"),
      roleIds: permissions.has("roles.manage")
        ? form.getAll("roleIds").map(String)
        : current.roles.map(({ roleId }) => roleId),
      badgeIds: permissions.has("badges.manage")
        ? form.getAll("badgeIds").map(String)
        : current.badges.map(({ badgeId }) => badgeId),
      status: z
        .enum([
          "PENDING_VERIFICATION",
          "ACTIVE",
          "SUSPENDED",
          "DISABLED",
          "DELETED",
        ])
        .parse(text(form, "status")),
      suspensionReason:
        z.string().max(1000).parse(text(form, "suspensionReason")) || undefined,
      suspendedUntil,
      warning: z.string().max(1000).parse(text(form, "warning")) || undefined,
      context: await getRequestContext(),
    });
    revalidatePath(`/admin/kullanicilar/${text(form, "userId")}`);
    return {
      success:
        "Kullanıcı yönetim bilgileri güncellendi; aktif oturumları yenilendi.",
    };
  } catch (error) {
    return failure(error);
  }
}

export async function updateRoleAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requirePermission("roles.manage");
    await updateRolePermissions({
      actorId: session.userId,
      roleCode: z
        .enum(["EDITOR", "MODERATOR", "SUPPORTER", "USER"])
        .parse(text(form, "roleCode")),
      permissionIds: form.getAll("permissionIds").map(String),
      color: color.parse(text(form, "color")),
      icon: z.string().max(50).parse(text(form, "icon")),
      context: await getRequestContext(),
    });
    revalidatePath("/admin/roller");
    return { success: "Rol ve yetkileri güncellendi." };
  } catch (error) {
    return failure(error);
  }
}

export async function saveBadgeAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requirePermission("badges.manage");
    const id = text(form, "id");
    const data = {
      code: z
        .string()
        .regex(/^[A-Z0-9_]+$/)
        .max(50)
        .parse(text(form, "code")),
      name: z.string().min(2).max(80).parse(text(form, "name")),
      description: z.string().max(500).parse(text(form, "description")) || null,
      type: z.enum(["SYSTEM", "CUSTOM"]).parse(text(form, "type")),
      color: color.parse(text(form, "color")),
      icon: z.string().max(50).parse(text(form, "icon")) || null,
      visible: form.get("visible") === "on",
      sortOrder: z.coerce
        .number()
        .int()
        .min(0)
        .max(10000)
        .parse(form.get("sortOrder")),
    };
    const previous = id ? await db.badge.findUnique({ where: { id } }) : null;
    const badge = id
      ? await db.badge.update({ where: { id }, data })
      : await db.badge.create({
          data: { ...data, createdById: session.userId },
        });
    await writeAdminAudit(
      session.userId,
      id ? "BADGE_UPDATED" : "BADGE_CREATED",
      "Badge",
      badge.id,
      previous ?? undefined,
      badge,
      await getRequestContext(),
    );
    revalidatePath("/admin/rozetler");
    return { success: "Rozet kaydedildi." };
  } catch (error) {
    return failure(error);
  }
}

export async function saveThemeAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requirePermission("settings.manage");
    const defaults = {
      primaryBackground: "#07090f",
      secondaryBackground: "#0d111a",
      cardBackground: "#121722",
      borderColor: "#252c38",
      textColor: "#f4f7fb",
      mutedTextColor: "#9aa5b5",
      linkColor: "#3a8dde",
      scarletAccent: "#ef4056",
      azureAccent: "#3a8dde",
      amberAccent: "#e9a23b",
      adminColor: "#ef4056",
      editorColor: "#3a8dde",
      moderatorColor: "#e9a23b",
      supporterColor: "#a873e8",
      userColor: "#8c98a8",
      borderRadius: 14,
      shadowIntensity: 24,
      headingFont: "Arial, Helvetica, sans-serif",
      bodyFont: "Arial, Helvetica, sans-serif",
      baseFontSize: 16,
    };
    const data =
      form.get("intent") === "reset"
        ? defaults
        : {
            primaryBackground: color.parse(text(form, "primaryBackground")),
            secondaryBackground: color.parse(text(form, "secondaryBackground")),
            cardBackground: color.parse(text(form, "cardBackground")),
            borderColor: color.parse(text(form, "borderColor")),
            textColor: color.parse(text(form, "textColor")),
            mutedTextColor: color.parse(text(form, "mutedTextColor")),
            linkColor: color.parse(text(form, "linkColor")),
            scarletAccent: color.parse(text(form, "scarletAccent")),
            azureAccent: color.parse(text(form, "azureAccent")),
            amberAccent: color.parse(text(form, "amberAccent")),
            adminColor: color.parse(text(form, "adminColor")),
            editorColor: color.parse(text(form, "editorColor")),
            moderatorColor: color.parse(text(form, "moderatorColor")),
            supporterColor: color.parse(text(form, "supporterColor")),
            userColor: color.parse(text(form, "userColor")),
            borderRadius: z.coerce
              .number()
              .int()
              .min(0)
              .max(32)
              .parse(form.get("borderRadius")),
            shadowIntensity: z.coerce
              .number()
              .int()
              .min(0)
              .max(100)
              .parse(form.get("shadowIntensity")),
            headingFont: z
              .enum(SITE_FONT_FAMILIES)
              .parse(text(form, "headingFont")),
            bodyFont: z
              .enum(SITE_FONT_FAMILIES)
              .parse(text(form, "bodyFont")),
            baseFontSize: z.coerce
              .number()
              .int()
              .min(MIN_BASE_FONT_SIZE)
              .max(MAX_BASE_FONT_SIZE)
              .parse(form.get("baseFontSize")),
          };
    const previous = await db.themeSetting.findUnique({
      where: { id: "default" },
    });
    await db.themeSetting.upsert({
      where: { id: "default" },
      update: data,
      create: { id: "default", ...data },
    });
    await writeAdminAudit(
      session.userId,
      form.get("intent") === "reset" ? "THEME_RESET" : "THEME_UPDATED",
      "ThemeSetting",
      "default",
      previous ?? undefined,
      data,
      await getRequestContext(),
    );
    revalidatePath("/", "layout");
    return { success: "Tema ayarları kaydedildi." };
  } catch (error) {
    return failure(error);
  }
}

export async function saveSiteSettingsAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requirePermission("settings.manage");
    const context = await getRequestContext();
    const logoFile = form.get("logoFile");
    const faviconFile = form.get("faviconFile");
    if (
      (logoFile instanceof File && logoFile.size) ||
      (faviconFile instanceof File && faviconFile.size)
    ) {
      await enforceRateLimit("upload", context.ip, session.userId);
    }
    const uploadedLogo =
      logoFile instanceof File && logoFile.size
        ? (
            await storeImage({
              file: logoFile,
              ownerId: session.userId,
              kind: "logo",
              context,
            })
          ).url
        : null;
    const uploadedFavicon =
      faviconFile instanceof File && faviconFile.size
        ? (
            await storeImage({
              file: faviconFile,
              ownerId: session.userId,
              kind: "favicon",
              context,
            })
          ).url
        : null;
    const safeUrl = (value: string) =>
      z
        .string()
        .url()
        .refine((url) => ["http:", "https:"].includes(new URL(url).protocol))
        .parse(value);
    const socialLinks = Object.fromEntries(
      ["github", "x", "linkedin", "youtube"].flatMap((key) => {
        const value = text(form, `social_${key}`);
        return value ? [[key, safeUrl(value)]] : [];
      }),
    );
    const safeAssetPath = (value: string) => {
      if (!value) return null;
      if (
        !value.startsWith("/api/uploads/") &&
        !value.startsWith("/brand/")
      )
        throw new Error("Logo ve favicon güvenli bir uygulama upload yolu olmalıdır.");
      return z.string().max(500).parse(value);
    };
    const data = {
      brandName: z.string().min(2).max(100).parse(text(form, "brandName")),
      shortName: z.string().min(2).max(40).parse(text(form, "shortName")),
      siteTitle: z.string().min(2).max(150).parse(text(form, "siteTitle")),
      siteDescription: z
        .string()
        .min(20)
        .max(500)
        .parse(text(form, "siteDescription")),
      domain: z
        .string()
        .min(3)
        .max(253)
        .regex(/^[a-z0-9.-]+$/)
        .parse(text(form, "domain")),
      canonicalUrl: safeUrl(text(form, "canonicalUrl")),
      contactEmail: z
        .string()
        .email()
        .max(254)
        .parse(text(form, "contactEmail")),
      logo:
        uploadedLogo ??
        safeAssetPath(text(form, "logo")),
      favicon:
        uploadedFavicon ??
        safeAssetPath(text(form, "favicon")),
      footerText: z.string().max(1000).parse(text(form, "footerText")) || null,
      socialLinks,
      registrationEnabled: form.get("registrationEnabled") === "on",
      maintenanceMode: form.get("maintenanceMode") === "on",
      defaultLocale: z
        .string()
        .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
        .parse(text(form, "defaultLocale")),
      allowedLocales: text(form, "allowedLocales")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 10),
      maxUploadBytes: z.coerce
        .number()
        .int()
        .min(1_048_576)
        .max(104_857_600)
        .parse(form.get("maxUploadBytes")),
      contentRules: {
        maxCommentLinks: z.coerce
          .number()
          .int()
          .min(0)
          .max(10)
          .parse(form.get("maxCommentLinks")),
        commentEditWindowMinutes: z.coerce
          .number()
          .int()
          .min(5)
          .max(1440)
          .parse(form.get("commentEditWindowMinutes")),
        maxUploadPixels: z.coerce
          .number()
          .int()
          .min(1_000_000)
          .max(100_000_000)
          .parse(form.get("maxUploadPixels")),
        monthlyUploadQuotaBytes: z.coerce
          .number()
          .int()
          .min(1_048_576)
          .max(2_147_000_000)
          .parse(form.get("monthlyUploadQuotaBytes")),
      },
    };
    const fontFamily = z
      .enum(SITE_FONT_FAMILIES)
      .parse(text(form, "siteFont"));
    const baseFontSize = z.coerce
      .number()
      .int()
      .min(MIN_BASE_FONT_SIZE)
      .max(MAX_BASE_FONT_SIZE)
      .parse(form.get("baseFontSize"));
    const [previous, previousTheme] = await Promise.all([
      db.siteSetting.findUnique({ where: { id: "default" } }),
      db.themeSetting.findUnique({ where: { id: "default" } }),
    ]);
    await db.$transaction([
      db.siteSetting.update({ where: { id: "default" }, data }),
      db.themeSetting.update({
        where: { id: "default" },
        data: {
          headingFont: fontFamily,
          bodyFont: fontFamily,
          baseFontSize,
        },
      }),
    ]);
    await writeAdminAudit(
      session.userId,
      "SITE_SETTINGS_UPDATED",
      "SiteSetting",
      "default",
      previous
        ? {
            site: previous,
            typography: previousTheme
              ? {
                  headingFont: previousTheme.headingFont,
                  bodyFont: previousTheme.bodyFont,
                  baseFontSize: previousTheme.baseFontSize,
                }
              : null,
          }
        : undefined,
      {
        site: data,
        typography: { fontFamily, baseFontSize },
      },
      context,
    );
    revalidatePath("/", "layout");
    return { success: "Site ayarları kaydedildi." };
  } catch (error) {
    return failure(error);
  }
}

export async function createAnnouncementAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requirePermission("settings.manage");
    const title = z.string().min(3).max(150).parse(text(form, "title"));
    const message = z.string().min(5).max(2000).parse(text(form, "message"));
    const target = z
      .enum(["all", "roles", "users"])
      .parse(text(form, "target"));
    const scheduledText = text(form, "scheduledAt");
    const scheduledAt = scheduledText ? new Date(scheduledText) : new Date();
    if (Number.isNaN(scheduledAt.getTime()))
      throw new Error("Yayın zamanı geçersiz.");
    const where =
      target === "roles"
        ? {
            roles: {
              some: { roleId: { in: form.getAll("roleIds").map(String) } },
            },
          }
        : target === "users"
          ? { id: { in: form.getAll("userIds").map(String) } }
          : {};
    const users = await db.user.findMany({
      where: { ...where, accountStatus: "ACTIVE", deletedAt: null },
      select: { id: true },
    });
    if (!users.length) throw new Error("Bildirim hedefi boş.");
    const email = form.get("email") === "on";
    const rows = users.map(({ id }) => ({
      type: "SYSTEM" as const,
      recipientId: id,
      senderId: session.userId,
      title,
      message,
      createdAt: scheduledAt,
      emailStatus: email ? ("PENDING" as const) : ("NOT_REQUESTED" as const),
      emailIdempotencyKey: email
        ? `announcement:${id}:${scheduledAt.toISOString()}:${title}`
        : null,
    }));
    await db.notification.createMany({ data: rows, skipDuplicates: true });
    if (email) {
      const redis = await getRedis();
      const created = await db.notification.findMany({
        where: {
          emailIdempotencyKey: {
            in: rows.flatMap(
              ({ emailIdempotencyKey }) => emailIdempotencyKey ?? [],
            ),
          },
        },
        select: { id: true },
      });
      if (created.length)
        await redis.zAdd(
          "notification:email",
          created.map(({ id }) => ({
            score: scheduledAt.getTime(),
            value: id,
          })),
        );
    }
    await writeAdminAudit(
      session.userId,
      "SYSTEM_ANNOUNCEMENT_CREATED",
      "Notification",
      undefined,
      undefined,
      {
        target,
        recipients: users.length,
        scheduledAt: scheduledAt.toISOString(),
        email,
      },
      await getRequestContext(),
    );
    revalidatePath("/admin/bildirimler");
    return { success: `${users.length} kullanıcı için duyuru planlandı.` };
  } catch (error) {
    return failure(error);
  }
}

export async function bulkPostAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requirePermission("posts.publish");
    const ids = [...new Set(form.getAll("postIds").map(String))].slice(0, 100);
    const intent = z
      .enum(["archive", "restore", "publish"])
      .parse(text(form, "intent"));
    if (!ids.length) throw new Error("En az bir yazı seçin.");
    const previous = await db.post.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true, deletedAt: true },
    });
    const data =
      intent === "archive"
        ? { status: "ARCHIVED" as const, version: { increment: 1 } }
        : intent === "restore"
          ? {
              deletedAt: null,
              status: "DRAFT" as const,
              version: { increment: 1 },
            }
          : {
              status: "PUBLISHED" as const,
              publishedAt: new Date(),
              version: { increment: 1 },
            };
    const allowedWhere: Prisma.PostWhereInput =
      intent === "publish"
        ? { status: { in: ["APPROVED", "SCHEDULED"] } }
        : intent === "archive"
          ? { status: "PUBLISHED" as const }
          : {
              OR: [
                { status: "ARCHIVED" as const },
                { deletedAt: { not: null } },
              ],
            };
    const result = await db.post.updateMany({
      where: { id: { in: ids }, ...allowedWhere },
      data,
    });
    await writeAdminAudit(
      session.userId,
      `POST_BULK_${intent.toUpperCase()}`,
      "Post",
      undefined,
      previous,
      { ids, count: result.count },
      await getRequestContext(),
    );
    revalidatePath("/admin/yazilar");
    revalidatePath("/haberler");
    return { success: `${result.count} yazı güncellendi.` };
  } catch (error) {
    return failure(error);
  }
}
