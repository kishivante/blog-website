import { z } from "zod";

export const reportSchema = z.object({
  targetType: z.enum(["POST", "COMMENT", "USER"]),
  targetId: z.string().min(1).max(100),
  reason: z.enum([
    "SPAM",
    "HARASSMENT",
    "MISINFORMATION",
    "COPYRIGHT",
    "DANGEROUS",
    "OTHER",
  ]),
  details: z.string().trim().max(2000),
});
