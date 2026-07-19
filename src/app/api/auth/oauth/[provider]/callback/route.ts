import { NextResponse, type NextRequest } from "next/server";
import {
  createFetchOAuthClient,
  consumeOAuthState,
  resolveOAuthIdentity,
  type OAuthProvider,
} from "@/services/oauth-service";
import { createSession, getSession } from "@/server/session";
import { getRequestContext } from "@/server/request-context";
import { enforceRateLimit } from "@/server/rate-limit";
import { db } from "@/server/db";
import { getServerEnv } from "@/lib/env";
import { logError } from "@/lib/logging";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const providerValue = (await params).provider;
    if (providerValue !== "google" && providerValue !== "github")
      throw new Error("Sağlayıcı geçersiz.");
    const provider: OAuthProvider = providerValue;
    const state = request.nextUrl.searchParams.get("state");
    const code = request.nextUrl.searchParams.get("code");
    if (!state || !code) throw new Error("OAuth yanıtı eksik.");
    const context = await getRequestContext();
    await enforceRateLimit("oauth-callback", context.ip);
    const pending = await consumeOAuthState(state);
    if (pending.provider !== provider)
      throw new Error("OAuth sağlayıcısı eşleşmiyor.");
    if (pending.intent.mode === "link") {
      const session = await getSession();
      if (!session || session.userId !== pending.intent.userId)
        throw new Error("OAuth hesap bağlama oturumu eşleşmiyor.");
    }
    const client = createFetchOAuthClient(provider);
    const redirectUri = new URL(
      `/api/auth/oauth/${provider}/callback`,
      getServerEnv().APP_URL,
    ).toString();
    const { accessToken } = await client.exchangeCode(
      code,
      pending.verifier,
      redirectUri,
    );
    const profile = await client.getProfile(accessToken);
    const userId = await resolveOAuthIdentity(
      provider,
      pending.intent,
      profile,
    );
    await db.auditLog.create({
      data: {
        actorId: userId,
        action: pending.intent.mode === "link" ? "OAUTH_LINKED" : "OAUTH_LOGIN",
        targetType: "User",
        targetId: userId,
      },
    });
    if (pending.intent.mode === "login") await createSession(userId, context);
    return NextResponse.redirect(
      new URL(
        pending.intent.mode === "link" ? "/ayarlar/bagli-hesaplar" : "/",
        getServerEnv().APP_URL,
      ),
    );
  } catch (error: unknown) {
    logError("oauth_callback_failed", error);
    return NextResponse.redirect(
      new URL("/giris?error=oauth", getServerEnv().APP_URL),
    );
  }
}
