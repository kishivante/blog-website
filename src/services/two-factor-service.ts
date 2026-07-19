import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { db } from "@/server/db";
import {
  decryptSecret,
  encryptSecret,
  randomToken,
  sha256,
} from "@/lib/crypto";
import { getServerEnv } from "@/lib/env";

export async function beginTwoFactorSetup(userId: string, email: string) {
  const secret = generateSecret();
  await db.twoFactorCredential.upsert({
    where: { userId },
    update: { secretEncrypted: encryptSecret(secret), enabledAt: null },
    create: { userId, secretEncrypted: encryptSecret(secret) },
  });
  const uri = generateURI({
    secret,
    issuer: getServerEnv().APP_NAME,
    label: email,
  });
  return {
    secret,
    qrDataUrl: await QRCode.toDataURL(uri, {
      errorCorrectionLevel: "M",
      width: 240,
    }),
  };
}

export async function verifyTotp(
  userId: string,
  token: string,
): Promise<boolean> {
  const credential = await db.twoFactorCredential.findUnique({
    where: { userId },
  });
  if (!credential) return false;
  return verifyTotpSecret(decryptSecret(credential.secretEncrypted), token);
}

export async function verifyTotpSecret(
  secret: string,
  token: string,
): Promise<boolean> {
  return (await verify({ secret, token })).valid;
}

export async function enableTwoFactor(
  userId: string,
  token: string,
): Promise<string[]> {
  if (!(await verifyTotp(userId, token)))
    throw new Error("Doğrulama kodu geçersiz.");
  const codes = Array.from({ length: 10 }, () => randomToken(9).toUpperCase());
  await db.$transaction([
    db.twoFactorCredential.update({
      where: { userId },
      data: { enabledAt: new Date() },
    }),
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.recoveryCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: sha256(code) })),
    }),
  ]);
  return codes;
}

export async function consumeRecoveryCode(
  userId: string,
  code: string,
): Promise<boolean> {
  const record = await db.recoveryCode.findUnique({
    where: { codeHash: sha256(code.trim().toUpperCase()) },
  });
  if (!record || record.userId !== userId || record.usedAt) return false;
  const result = await db.recoveryCode.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return result.count === 1;
}
