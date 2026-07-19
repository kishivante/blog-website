import { getRedis } from "@/server/redis";
import { sha256 } from "@/lib/crypto";

export type RateLimitKind =
  | "login"
  | "register"
  | "password-reset"
  | "verify-email"
  | "two-factor"
  | "oauth-callback"
  | "comment"
  | "interaction"
  | "report"
  | "post-submit"
  | "upload"
  | "search";

const limits: Record<RateLimitKind, { count: number; seconds: number }> = {
  login: { count: 10, seconds: 900 },
  register: { count: 5, seconds: 3600 },
  "password-reset": { count: 5, seconds: 3600 },
  "verify-email": { count: 5, seconds: 3600 },
  "two-factor": { count: 8, seconds: 900 },
  "oauth-callback": { count: 20, seconds: 900 },
  comment: { count: 20, seconds: 300 },
  interaction: { count: 60, seconds: 60 },
  report: { count: 10, seconds: 3600 },
  "post-submit": { count: 10, seconds: 3600 },
  upload: { count: 30, seconds: 3600 },
  search: { count: 60, seconds: 60 },
};

export async function enforceRateLimit(
  kind: RateLimitKind,
  ...identifiers: string[]
): Promise<void> {
  const redis = await getRedis();
  const policy = limits[kind];
  for (const identifier of identifiers.filter(Boolean)) {
    const key = `rl:${kind}:${sha256(identifier)}`;
    const value = await redis.incr(key);
    if (value === 1) await redis.expire(key, policy.seconds);
    if (value > policy.count)
      throw new Error(
        "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.",
      );
  }
}
