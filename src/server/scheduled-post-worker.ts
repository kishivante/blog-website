import { db } from "@/server/db";
import { getRedis } from "@/server/redis";
import { sendMail } from "@/server/mailer";
import { getPublicConfig } from "@/lib/env";
import { cleanupOrphanedStorage } from "@/services/upload-service";
import { logError } from "@/lib/logging";
import {
  processDueAccountDeletions,
  processExpiredSuspensions,
} from "@/services/profile-service";

const intervalMs = 15_000;
let lastStorageCleanup = 0;

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

async function publishDuePosts() {
  const now = new Date();
  const redis = await getRedis();
  const queued = await redis.zRangeByScore("scheduled:posts", 0, now.getTime());
  const due = await db.post.findMany({
    where: {
      status: "SCHEDULED",
      scheduledPublishAt: { lte: now },
      deletedAt: null,
    },
    select: { id: true },
  });
  const ids = [...new Set([...queued, ...due.map(({ id }) => id)])];
  for (const id of ids) {
    const result = await db.post.updateMany({
      where: {
        id,
        status: "SCHEDULED",
        scheduledPublishAt: { lte: now },
        deletedAt: null,
      },
      data: {
        status: "PUBLISHED",
        publishedAt: now,
        version: { increment: 1 },
      },
    });
    if (result.count)
      await db.postReview.create({
        data: {
          postId: id,
          decision: "PUBLISHED",
          note: "Zamanlanmış yayın worker tarafından yayımlandı.",
        },
      });
    await redis.zRem("scheduled:posts", id);
  }
}

async function sendQueuedNotifications() {
  const now = new Date();
  const redis = await getRedis();
  const queued = await redis.zRangeByScore(
    "notification:email",
    0,
    now.getTime(),
  );
  const pending = await db.notification.findMany({
    where: {
      emailStatus: "PENDING",
      emailAttempts: { lt: 5 },
      OR: [{ emailNextAttemptAt: null }, { emailNextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: { recipient: { select: { email: true } } },
  });
  const ids = new Set([...queued, ...pending.map(({ id }) => id)]);
  for (const id of ids) {
    const notification =
      pending.find((item) => item.id === id) ??
      (await db.notification.findUnique({
        where: { id },
        include: { recipient: { select: { email: true } } },
      }));
    if (
      !notification ||
      notification.emailStatus !== "PENDING" ||
      notification.emailAttempts >= 5
    ) {
      await redis.zRem("notification:email", id);
      continue;
    }
    try {
      await sendMail({
        to: notification.recipient.email,
        subject: notification.title,
        text: `${notification.message}\n\n${getPublicConfig().appUrl}/bildirimler`,
        html: `<h1>${escapeHtml(notification.title)}</h1><p>${escapeHtml(notification.message)}</p><p><a href="${escapeHtml(getPublicConfig().appUrl)}/bildirimler">Bildirim merkezini aç</a></p>`,
      });
      await db.notification.update({
        where: { id },
        data: {
          emailStatus: "SENT",
          emailSentAt: new Date(),
          emailAttempts: { increment: 1 },
          emailLastError: null,
        },
      });
      await redis.zRem("notification:email", id);
    } catch (error) {
      const attempts = notification.emailAttempts + 1;
      const next = new Date(
        Date.now() + Math.min(24 * 60, 2 ** attempts * 15) * 60 * 1000,
      );
      await db.notification.update({
        where: { id },
        data: {
          emailStatus: attempts >= 5 ? "FAILED" : "PENDING",
          emailAttempts: attempts,
          emailNextAttemptAt: next,
          emailLastError: (error instanceof Error
            ? error.message
            : "unknown"
          ).slice(0, 500),
        },
      });
      if (attempts >= 5) await redis.zRem("notification:email", id);
      else
        await redis.zAdd("notification:email", [
          { score: next.getTime(), value: id },
        ]);
    }
  }
}

async function run() {
  await publishDuePosts();
  await sendQueuedNotifications();
  await processDueAccountDeletions();
  await processExpiredSuspensions();
  await cleanupOrphanedStorage().catch((error: unknown) =>
    logError("storage_cleanup_failed", error),
  );
  lastStorageCleanup = Date.now();
  setInterval(
    () =>
      Promise.all([
        publishDuePosts(),
        sendQueuedNotifications(),
        processDueAccountDeletions(),
        processExpiredSuspensions(),
        Date.now() - lastStorageCleanup > 6 * 60 * 60 * 1000
          ? cleanupOrphanedStorage().then(() => {
              lastStorageCleanup = Date.now();
            })
          : Promise.resolve(),
      ]).catch((error: unknown) =>
        logError("background_worker_failed", error),
      ),
    intervalMs,
  );
}

run().catch((error: unknown) => {
  logError("scheduled_post_worker_start_failed", error);
  process.exitCode = 1;
});
