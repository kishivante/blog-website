import { describe, expect, it } from "vitest";
import {
  hashPassword,
  passwordPolicyError,
  verifyPassword,
} from "@/server/password";
import { decryptSecret, encryptSecret, sha256 } from "@/lib/crypto";
import { normalizeIdentity } from "@/lib/identity";

describe("authentication primitives", () => {
  it("Argon2id ile parola üretir ve doğrular", async () => {
    const hash = await hashPassword("doğru ve uzun bir parola cümlesi");
    expect(hash).toContain("$argon2id$");
    await expect(
      verifyPassword(hash, "doğru ve uzun bir parola cümlesi"),
    ).resolves.toBe(true);
    await expect(verifyPassword(hash, "yanlış parola")).resolves.toBe(false);
  });

  it("zayıf ve aşırı uzun parolaları reddeder", () => {
    expect(passwordPolicyError("kısa")).toBeTruthy();
    expect(passwordPolicyError("password1234")).toBeTruthy();
    expect(passwordPolicyError("a".repeat(129))).toBeTruthy();
    expect(
      passwordPolicyError("uzun ve benzersiz bir parola cümlesi"),
    ).toBeNull();
  });

  it("kimlikleri normalize eder ve secret değerlerini doğrulanabilir şifreler", () => {
    expect(normalizeIdentity("  KİSHİ_01 ")).toBe("ki̇shi̇_01");
    const encrypted = encryptSecret("TOTP-SECRET");
    expect(encrypted).not.toContain("TOTP-SECRET");
    expect(decryptSecret(encrypted)).toBe("TOTP-SECRET");
    expect(sha256("token")).toHaveLength(64);
  });
});
