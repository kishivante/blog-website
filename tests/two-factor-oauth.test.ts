import { describe, expect, it, vi } from "vitest";
import { generate, generateSecret } from "otplib";
import { verifyTotpSecret } from "@/services/two-factor-service";
import {
  fetchVerifiedOAuthProfile,
  type OAuthProviderClient,
} from "@/services/oauth-service";

describe("two-factor authentication", () => {
  it("geçerli TOTP kodunu kabul eder, hatalı kodu reddeder", async () => {
    const secret = generateSecret();
    const code = await generate({ secret });
    await expect(verifyTotpSecret(secret, code)).resolves.toBe(true);
    await expect(verifyTotpSecret(secret, "000000")).resolves.toBe(false);
  });
});

describe("OAuth provider boundary", () => {
  it("PKCE verifier ile token alır ve yalnızca doğrulanmış e-postayı kabul eder", async () => {
    const client: OAuthProviderClient = {
      exchangeCode: vi.fn().mockResolvedValue({ accessToken: "access-token" }),
      getProfile: vi
        .fn()
        .mockResolvedValue({
          providerAccountId: "42",
          email: "user@example.com",
          emailVerified: true,
        }),
    };
    await expect(
      fetchVerifiedOAuthProfile(
        client,
        "code",
        "verifier",
        "https://example.com/callback",
      ),
    ).resolves.toMatchObject({ providerAccountId: "42" });
    expect(client.exchangeCode).toHaveBeenCalledWith(
      "code",
      "verifier",
      "https://example.com/callback",
    );
  });

  it("doğrulanmamış sağlayıcı e-postasını reddeder", async () => {
    const client: OAuthProviderClient = {
      exchangeCode: async () => ({ accessToken: "token" }),
      getProfile: async () => ({
        providerAccountId: "42",
        email: "user@example.com",
        emailVerified: false,
      }),
    };
    await expect(
      fetchVerifiedOAuthProfile(client, "code", "verifier", "callback"),
    ).rejects.toThrow("doğrulanmış");
  });
});
