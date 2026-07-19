import { z } from "zod";
import { slugSchema } from "@/validators/post";

const contentSchema = z
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
      context.addIssue({ code: "custom", message: "Editör içeriği geçersiz." });
      return z.NEVER;
    }
  });

export const wikiFormSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(5).max(180),
  slug: slugSchema,
  summary: z.string().trim().min(20).max(500),
  content: contentSchema,
  categoryId: z.string().optional().default(""),
  tagIds: z.array(z.string()).max(15).default([]),
  linkedPageIds: z.array(z.string()).max(30).default([]),
  changeSummary: z.string().trim().min(3).max(300),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  locked: z.boolean(),
  lockedReason: z.string().trim().max(300),
  version: z.coerce.number().int().min(1),
});

export const wikiSearchSchema = z.object({
  q: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
