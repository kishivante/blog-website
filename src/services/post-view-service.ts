import "server-only";
import { db } from "@/server/db";
import { getRedis } from "@/server/redis";
import { sha256 } from "@/lib/crypto";
import type { RequestContext } from "@/server/request-context";

const botPattern =
  /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse/i;

export async function recordPostView(input: {
  postId: string;
  viewerId?: string;
  anonymousId?: string;
  context: RequestContext;
}) {
  const existing = await db.postViewAggregate.findUnique({
    where: { postId: input.postId },
  });
  if (botPattern.test(input.context.userAgent)) return existing;
  const identity = input.viewerId ?? input.anonymousId ?? "anonymous";
  const visitorHash = sha256(
    `${identity}:${sha256(input.context.ip)}:${sha256(input.context.userAgent)}`,
  );
  const redis = await getRedis();
  const unique = await redis.set(`view:${input.postId}:${visitorHash}`, "1", {
    NX: true,
    EX: 30 * 60,
  });
  if (!unique) return existing;
  const now = new Date();
  await db.$transaction([
    db.postView.create({
      data: {
        postId: input.postId,
        viewerId: input.viewerId,
        visitorHash,
        ipHash: sha256(input.context.ip),
        userAgent: input.context.userAgent.slice(0, 500),
        viewedAt: now,
      },
    }),
    db.postViewAggregate.upsert({
      where: { postId: input.postId },
      create: {
        postId: input.postId,
        totalViews: 1,
        uniqueViews: 1,
        lastViewedAt: now,
      },
      update: {
        totalViews: { increment: 1 },
        uniqueViews: { increment: 1 },
        lastViewedAt: now,
      },
    }),
  ]);
  return db.postViewAggregate.findUnique({ where: { postId: input.postId } });
}
