import { getServerEnv } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/crypto";
import { getRedis } from "@/server/redis";
import { db } from "@/server/db";
import { normalizeIdentity } from "@/lib/identity";
import { AccountStatus } from "@prisma/client";

export type OAuthProvider = "google" | "github";
export type OAuthIntent = { mode: "login" } | { mode: "link"; userId: string };
export type OAuthProfile = {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  username?: string;
};
export type OAuthProviderClient = {
  exchangeCode(
    code: string,
    verifier: string,
    redirectUri: string,
  ): Promise<{ accessToken: string }>;
  getProfile(accessToken: string): Promise<OAuthProfile>;
};

export async function fetchVerifiedOAuthProfile(
  client: OAuthProviderClient,
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<OAuthProfile> {
  const { accessToken } = await client.exchangeCode(
    code,
    verifier,
    redirectUri,
  );
  const profile = await client.getProfile(accessToken);
  if (!profile.emailVerified)
    throw new Error("Sağlayıcı doğrulanmış bir e-posta adresi döndürmedi.");
  return profile;
}

function providerConfig(provider: OAuthProvider) {
  const env = getServerEnv();
  if (provider === "google")
    return {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      scope: "openid email profile",
    };
  return {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    authorizeUrl: "https://github.com/login/oauth/authorize",
    scope: "read:user user:email",
  };
}

export async function createOAuthAuthorization(
  provider: OAuthProvider,
  intent: OAuthIntent,
): Promise<string> {
  const config = providerConfig(provider);
  if (!config.clientId || !config.clientSecret)
    throw new Error(`${provider} OAuth yapılandırılmamış.`);
  const state = randomToken();
  const verifier = randomToken(48);
  const challenge = Buffer.from(sha256(verifier), "hex").toString("base64url");
  await (
    await getRedis()
  ).set(
    `oauth:${sha256(state)}`,
    JSON.stringify({ provider, intent, verifier }),
    { EX: 600 },
  );
  const redirectUri = new URL(
    `/api/auth/oauth/${provider}/callback`,
    getServerEnv().APP_URL,
  ).toString();
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function consumeOAuthState(state: string) {
  const redis = await getRedis();
  const key = `oauth:${sha256(state)}`;
  const raw = await redis.getDel(key);
  if (!raw)
    throw new Error("OAuth güvenlik anahtarı geçersiz veya süresi dolmuş.");
  return JSON.parse(raw) as {
    provider: OAuthProvider;
    intent: OAuthIntent;
    verifier: string;
  };
}

export async function linkOAuthProfile(
  userId: string,
  provider: OAuthProvider,
  profile: OAuthProfile,
): Promise<void> {
  if (!profile.emailVerified)
    throw new Error("Sağlayıcı doğrulanmış bir e-posta adresi döndürmedi.");
  const occupied = await db.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId: profile.providerAccountId,
      },
    },
  });
  if (occupied && occupied.userId !== userId)
    throw new Error("Bu harici hesap başka bir kullanıcıya bağlı.");
  await db.oAuthAccount.upsert({
    where: { userId_provider: { userId, provider } },
    update: { providerAccountId: profile.providerAccountId },
    create: { userId, provider, providerAccountId: profile.providerAccountId },
  });
}

export async function unlinkOAuthAccount(
  userId: string,
  provider: OAuthProvider,
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { oauthAccounts: true },
  });
  if (!user) throw new Error("Hesap bulunamadı.");
  if (!user.passwordHash && user.oauthAccounts.length <= 1)
    throw new Error("Hesabın kullanılabilir tek giriş yöntemi ayrılamaz.");
  await db.oAuthAccount.deleteMany({ where: { userId, provider } });
}

export async function resolveOAuthIdentity(
  provider: OAuthProvider,
  intent: OAuthIntent,
  profile: OAuthProfile,
): Promise<string> {
  if (!profile.emailVerified)
    throw new Error("Sağlayıcı e-posta adresini doğrulamamış.");
  if (intent.mode === "link") {
    await linkOAuthProfile(intent.userId, provider, profile);
    return intent.userId;
  }
  const linked = await db.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId: profile.providerAccountId,
      },
    },
  });
  if (linked) return linked.userId;
  const normalizedEmail = normalizeIdentity(profile.email);
  const existing = await db.user.findUnique({ where: { normalizedEmail } });
  if (existing)
    throw new Error(
      "Bu e-posta ile bir hesap mevcut. Önce parola ile giriş yapıp hesabı ayarlardan bağlayın.",
    );
  const site = await db.siteSetting.findUnique({
    where: { id: "default" },
    select: { registrationEnabled: true },
  });
  if (site && !site.registrationEnabled)
    throw new Error("Yeni hesap kaydı şu anda kapalı.");
  const role = await db.role.findUnique({ where: { code: "USER" } });
  if (!role) throw new Error("Varsayılan rol bulunamadı.");
  const base =
    normalizeIdentity(profile.username ?? profile.email.split("@")[0] ?? "user")
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 24) || "user";
  let normalizedUsername = base;
  for (
    let suffix = 0;
    await db.user.findUnique({ where: { normalizedUsername } });
    suffix += 1
  )
    normalizedUsername = `${base}_${suffix + 1}`;
  const user = await db.user.create({
    data: {
      username: normalizedUsername,
      normalizedUsername,
      email: profile.email,
      normalizedEmail,
      emailVerifiedAt: new Date(),
      accountStatus: AccountStatus.ACTIVE,
      oauthAccounts: {
        create: { provider, providerAccountId: profile.providerAccountId },
      },
      privacySettings: { create: {} },
      notificationSettings: { create: {} },
      roles: { create: { roleId: role.id } },
    },
  });
  return user.id;
}

export function createFetchOAuthClient(
  provider: OAuthProvider,
): OAuthProviderClient {
  const config = providerConfig(provider);
  return {
    async exchangeCode(code, verifier, redirectUri) {
      const tokenUrl =
        provider === "google"
          ? "https://oauth2.googleapis.com/token"
          : "https://github.com/login/oauth/access_token";
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("OAuth token değişimi başarısız.");
      const payload = (await response.json()) as { access_token?: string };
      if (!payload.access_token)
        throw new Error("OAuth access token alınamadı.");
      return { accessToken: payload.access_token };
    },
    async getProfile(accessToken) {
      if (provider === "google") {
        const response = await fetch(
          "https://openidconnect.googleapis.com/v1/userinfo",
          {
            headers: { authorization: `Bearer ${accessToken}` },
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as {
          sub?: string;
          email?: string;
          email_verified?: boolean;
        };
        if (!response.ok || !payload.sub || !payload.email)
          throw new Error("Google profili alınamadı.");
        return {
          providerAccountId: payload.sub,
          email: payload.email,
          emailVerified: payload.email_verified === true,
        };
      }
      const [profileResponse, emailResponse] = await Promise.all([
        fetch("https://api.github.com/user", {
          headers: {
            authorization: `Bearer ${accessToken}`,
            accept: "application/vnd.github+json",
          },
          cache: "no-store",
        }),
        fetch("https://api.github.com/user/emails", {
          headers: {
            authorization: `Bearer ${accessToken}`,
            accept: "application/vnd.github+json",
          },
          cache: "no-store",
        }),
      ]);
      const profile = (await profileResponse.json()) as {
        id?: number;
        login?: string;
      };
      const emails = (await emailResponse.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const email = emails.find((item) => item.primary && item.verified);
      if (!profileResponse.ok || !emailResponse.ok || !profile.id || !email)
        throw new Error("GitHub doğrulanmış e-postası alınamadı.");
      return {
        providerAccountId: String(profile.id),
        email: email.email,
        emailVerified: true,
        username: profile.login,
      };
    },
  };
}
