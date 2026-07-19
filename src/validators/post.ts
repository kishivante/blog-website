import { z } from "zod";

const safeOptionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    if (!value) return true;
    if (/^\/api\/uploads\/[a-zA-Z0-9._~!$&'()*+,;=:@%/-]+$/.test(value))
      return true;
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Yalnızca geçerli http veya https adresleri kullanılabilir.");

export const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(160)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug küçük harf, rakam ve tire içerebilir.",
  );

export const postFormSchema = z.object({
  id: z.string().optional(),
  title: z
    .string()
    .trim()
    .min(5, "Başlık en az 5 karakter olmalıdır.")
    .max(180),
  slug: slugSchema,
  excerpt: z.string().trim().max(500),
  content: z
    .string()
    .min(2)
    .max(2_000_000)
    .transform((value, context) => {
      try {
        const parsed: unknown = JSON.parse(value);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          throw new Error();
        return parsed;
      } catch {
        context.addIssue({
          code: "custom",
          message: "Editör içeriği geçersiz.",
        });
        return z.NEVER;
      }
    }),
  categoryId: z.string().optional().default(""),
  tagIds: z.array(z.string()).max(15).default([]),
  seriesId: z.string().optional().default(""),
  seriesOrder: z.coerce.number().int().min(1).max(10000).optional(),
  coverImage: safeOptionalUrl,
  bannerColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .or(z.literal("")),
  allowComments: z.boolean(),
  seoTitle: z.string().trim().max(70),
  seoDescription: z.string().trim().max(170),
  canonicalUrl: safeOptionalUrl,
  version: z.coerce.number().int().min(1).default(1),
  intent: z.enum(["draft", "submit"]),
});
