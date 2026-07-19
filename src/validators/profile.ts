import { z } from "zod";
import { emailSchema, passwordSchema, usernameSchema } from "@/validators/auth";

const safeUrl = z
  .string()
  .trim()
  .max(300)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Yalnızca geçerli http veya https adresleri kullanılabilir.");

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(80, "Görüntülenen ad en fazla 80 karakter olabilir."),
  biography: z
    .string()
    .trim()
    .max(500, "Biyografi en fazla 500 karakter olabilir."),
  location: z.string().trim().max(100, "Konum en fazla 100 karakter olabilir."),
  website: safeUrl,
  locale: z.enum(["tr", "en"]),
  timezone: z.string().trim().min(1).max(80),
});

export const appearanceSchema = z.object({
  profileAccent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Geçerli bir renk seçin."),
  layout: z.enum(["STANDARD", "COMPACT", "EDITORIAL"]),
});

export const privacySchema = z.object({
  profileVisibility: z.enum(["PUBLIC", "AUTHENTICATED", "PRIVATE"]),
  showFollowers: z.boolean(),
  showFollowing: z.boolean(),
  showCommentHistory: z.boolean(),
  showWikiContributions: z.boolean(),
  showOnlineStatus: z.boolean(),
});

export const notificationSettingsSchema = z.object({
  emailEnabled: z.boolean(),
  securityEmail: z.boolean(),
  commentNotifications: z.boolean(),
  replyNotifications: z.boolean(),
  followerNotifications: z.boolean(),
  reviewNotifications: z.boolean(),
  marketingEmail: z.boolean(),
});

export const usernameChangeSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    newPasswordConfirm: z.string(),
    revokeOthers: z.boolean(),
  })
  .refine((value) => value.newPassword === value.newPasswordConfirm, {
    path: ["newPasswordConfirm"],
    message: "Yeni parolalar eşleşmiyor.",
  });

export const emailChangeSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const criticalActionSchema = z.object({
  password: z.string().min(1),
  totp: z.string().trim().max(32).optional().default(""),
});
