import { cookies } from "next/headers";
import { db } from "@/server/db";
import { getRedis } from "@/server/redis";
import { randomToken, sha256 } from "@/lib/crypto";
import type { RequestContext } from "@/server/request-context";

const COOKIE_NAME = "__Host-scarlet_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export async function createSession(
  userId: string,
  context: RequestContext,
): Promise<void> {
  const store = await cookies();
  const previousToken = store.get(COOKIE_NAME)?.value;
  if (previousToken) {
    await db.session.updateMany({
      where: { tokenHash: sha256(previousToken), revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "session_rotated" },
    });
  }
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
  const session = await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      ipAddress: context.ip,
      userAgent: context.userAgent,
      expiresAt,
    },
  });
  const redis = await getRedis();
  await redis.set(
    `session:${sha256(token)}`,
    JSON.stringify({ id: session.id, userId }),
    { EX: SESSION_SECONDS },
  );
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const tokenHash = sha256(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          roles: {
            include: {
              role: {
                include: { permissions: { include: { permission: true } } },
              },
            },
          },
          twoFactor: true,
        },
      },
    },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.deletedAt ||
    session.user.suspendedAt ||
    session.user.accountStatus !== "ACTIVE"
  )
    return null;
  return session;
}

export async function revokeCurrentSession(reason = "logout"): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = sha256(token);
    await db.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    (await getRedis()).del(`session:${tokenHash}`).catch(() => undefined);
  }
  store.delete(COOKIE_NAME);
}

export async function revokeOtherSessions(
  userId: string,
  currentSessionId: string,
): Promise<number> {
  const result = await db.session.updateMany({
    where: { userId, id: { not: currentSessionId }, revokedAt: null },
    data: {
      revokedAt: new Date(),
      revokedReason: "user_revoked_other_sessions",
    },
  });
  return result.count;
}
