import type { NotificationType } from "@prisma/client";
import { db } from "@/server/db";
import { getRedis } from "@/server/redis";
import { sha256 } from "@/lib/crypto";

type NotificationInput = {
  type: NotificationType;
  recipientId: string;
  senderId?: string;
  objectType?: string;
  objectId?: string;
  title: string;
  message: string;
  emailKey?: keyof EmailPreferences;
};

type EmailPreferences = {
  emailEnabled: boolean;
  securityEmail: boolean;
  commentNotifications: boolean;
  replyNotifications: boolean;
  followerNotifications: boolean;
  reviewNotifications: boolean;
  marketingEmail: boolean;
};

export async function createNotification(input: NotificationInput) {
  if (input.senderId && input.senderId === input.recipientId) return null;
  const user = await db.user.findUnique({
    where: { id: input.recipientId },
    include: { notificationSettings: true },
  });
  if (!user || user.deletedAt || user.accountStatus === "DELETED") return null;
  const settings = user.notificationSettings;
  const critical = input.type === "SECURITY";
  const emailAllowed =
    critical ||
    Boolean(
      settings?.emailEnabled && (!input.emailKey || settings[input.emailKey]),
    );
  const idempotency = emailAllowed
    ? sha256(
        [
          input.type,
          input.recipientId,
          input.objectType,
          input.objectId,
          input.title,
        ].join(":"),
      )
    : undefined;
  const notification = await db.notification
    .create({
      data: {
        type: input.type,
        recipientId: input.recipientId,
        senderId: input.senderId,
        objectType: input.objectType,
        objectId: input.objectId,
        title: input.title,
        message: input.message,
        emailStatus: emailAllowed ? "PENDING" : "NOT_REQUESTED",
        emailNextAttemptAt: emailAllowed ? new Date() : null,
        emailIdempotencyKey: idempotency,
      },
    })
    .catch(async (error: unknown) => {
      if (
        emailAllowed &&
        error instanceof Error &&
        error.message.includes("emailIdempotencyKey")
      ) {
        return db.notification.findUnique({
          where: { emailIdempotencyKey: idempotency },
        });
      }
      throw error;
    });
  if (notification && emailAllowed)
    await (await getRedis())
      .zAdd("notification:email", [
        { score: Date.now(), value: notification.id },
      ])
      .catch(() => undefined);
  return notification;
}

export async function unreadNotificationCount(userId: string) {
  return db.notification.count({
    where: { recipientId: userId, readAt: null, createdAt: { lte: new Date() } },
  });
}
