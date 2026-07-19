import { z } from "zod";
import { passwordPolicyError } from "@/server/password";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Kullanıcı adı en az 3 karakter olmalıdır.")
  .max(32)
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Yalnızca harf, rakam ve alt çizgi kullanılabilir.",
  );
export const emailSchema = z
  .email("Geçerli bir e-posta adresi girin.")
  .max(254);
export const passwordSchema = z.string().superRefine((value, context) => {
  const error = passwordPolicyError(value);
  if (error) context.addIssue({ code: "custom", message: error });
});
export const registrationSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
    terms: z.literal("on", {
      error: "Kullanım koşullarını ve gizlilik politikasını kabul etmelisiniz.",
    }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Parolalar eşleşmiyor.",
  });
export const loginSchema = z.object({
  identity: z.string().trim().min(1),
  password: z.string().min(1),
});
export const tokenSchema = z.string().min(32).max(512);
export const totpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Altı haneli doğrulama kodunu girin.");
