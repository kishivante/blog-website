import { headers } from "next/headers";
import { hmac, safeEqual } from "@/lib/crypto";
import { getServerEnv } from "@/lib/env";

function timeBucket(): number {
  return Math.floor(Date.now() / 3_600_000);
}

export async function createCsrfToken(): Promise<string> {
  const userAgent = (await headers()).get("user-agent") ?? "";
  const bucket = timeBucket();
  return `${bucket}.${hmac(`${bucket}:${userAgent}`)}`;
}

export async function assertCsrfToken(
  token: FormDataEntryValue | null,
): Promise<void> {
  if (typeof token !== "string")
    throw new Error("Güvenlik doğrulaması başarısız.");
  const [bucketText, signature] = token.split(".");
  const bucket = Number(bucketText);
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const allowed = new URL(getServerEnv().APP_URL).origin;
  if (!origin || origin !== allowed) throw new Error("Geçersiz istek kaynağı.");
  if (
    !signature ||
    !Number.isInteger(bucket) ||
    Math.abs(timeBucket() - bucket) > 1
  )
    throw new Error("Güvenlik anahtarının süresi doldu.");
  const expected = hmac(`${bucket}:${requestHeaders.get("user-agent") ?? ""}`);
  if (!safeEqual(signature, expected))
    throw new Error("Güvenlik doğrulaması başarısız.");
}
