import { z } from "zod";

const optionalString = z.string().optional().default("");
const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_NAME: z.string().min(1),
  APP_URL: z.url(),
  APP_DOMAIN: z.string().min(1),
  TRUSTED_HOSTS: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  REDIS_PASSWORD: z.string().min(16),
  AUTH_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  INITIAL_ADMIN_USERNAME: z.string().min(3),
  INITIAL_ADMIN_EMAIL: z.email(),
  INITIAL_ADMIN_PASSWORD: z.string().min(12),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
  UPLOAD_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  UPLOAD_LOCAL_PATH: z.string().min(1),
  S3_ENDPOINT: optionalString,
  S3_REGION: optionalString,
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  S3_PRIVATE_BUCKET: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  S3_SIGNED_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(3600)
    .default(900),
  UPLOAD_MONTHLY_QUOTA_BYTES: z.coerce
    .number()
    .int()
    .min(1_048_576)
    .default(524_288_000),
  UPLOAD_MAX_PIXELS: z.coerce
    .number()
    .int()
    .min(1_000_000)
    .max(100_000_000)
    .default(40_000_000),
  CLAMAV_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  CERTBOT_EMAIL: z.email(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cachedEnv ??= serverSchema.parse(process.env);
  return cachedEnv;
}

export function getPublicConfig() {
  return {
    appName: process.env.APP_NAME ?? "Uygulama",
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
    locale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "tr",
  };
}
