import "server-only";
import { db } from "@/server/db";
import { getRedis } from "@/server/redis";
import { sha256 } from "@/lib/crypto";
import { createNotification } from "@/services/notification-service";
import type { RequestContext } from "@/server/request-context";
import {
  COMMENT_EDIT_WINDOW_MS,
  COMMENT_MAX_DEPTH,
  normalizeCommentContent,
} from "@/validators/comment";

async function assertNotBlocked(actorId: string, otherUserId: string) {
  const blocked = await db.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: actorId, blockedId: otherUserId },
        { blockerId: otherUserId, blockedId: actorId },
      ],
    },
  });
  if (blocked) throw new Error("Bu kullanıcıyla etkileşim kuramazsınız.");
}

async function getCommentPolicy() {
  const site = await db.siteSetting.findUnique({
    where: { id: "default" },
    select: { contentRules: true },
  });
  const rules =
    site?.contentRules &&
    typeof site.contentRules === "object" &&
    !Array.isArray(site.contentRules)
      ? (site.contentRules as Record<string, unknown>)
      : {};
  return {
    maxLinks:
      typeof rules.maxCommentLinks === "number"
        ? Math.max(0, Math.min(10, rules.maxCommentLinks))
        : 3,
    editWindowMs:
      typeof rules.commentEditWindowMinutes === "number"
        ? Math.max(5, Math.min(1440, rules.commentEditWindowMinutes)) * 60_000
        : COMMENT_EDIT_WINDOW_MS,
  };
}

export async function createComment(input: {
  postId: string;
  authorId: string;
  parentId?: string;
  content: string;
  context: RequestContext;
}) {
  const policy = await getCommentPolicy();
  const content = normalizeCommentContent(input.content, policy.maxLinks);
  const post = await db.post.findFirst({
    where: { id: input.postId, status: "PUBLISHED", deletedAt: null },
    select: { id: true, slug: true, authorId: true, allowComments: true },
  });
  if (!post || !post.allowComments)
    throw new Error("Bu yazıda yorum yapılamıyor.");
  const parent = input.parentId
    ? await db.comment.findFirst({
        where: { id: input.parentId, postId: post.id, status: "VISIBLE" },
        select: { id: true, authorId: true, depth: true },
      })
    : null;
  if (input.parentId && !parent)
    throw new Error("Yanıtlanan yorum bulunamadı.");
  const depth = parent ? parent.depth + 1 : 0;
  if (depth > COMMENT_MAX_DEPTH)
    throw new Error(
      `Yorum cevapları en fazla ${COMMENT_MAX_DEPTH} seviye olabilir.`,
    );
  await assertNotBlocked(input.authorId, parent?.authorId ?? post.authorId);
  const redis = await getRedis();
  const fingerprint = sha256(
    `${input.authorId}:${post.id}:${parent?.id ?? "root"}:${content.toLocaleLowerCase("tr-TR")}`,
  );
  if (
    !(await redis.set(`comment:duplicate:${fingerprint}`, "1", {
      NX: true,
      EX: 10 * 60,
    }))
  )
    throw new Error("Aynı yorumu kısa süre içinde tekrar gönderemezsiniz.");
  const recentKey = `comment:flood:${sha256(input.authorId)}`;
  const recent = await redis.incr(recentKey);
  if (recent === 1) await redis.expire(recentKey, 60);
  if (recent > 5)
    throw new Error("Çok hızlı yorum gönderiyorsunuz. Lütfen bekleyin.");
  const comment = await db.comment.create({
    data: {
      postId: post.id,
      authorId: input.authorId,
      parentId: parent?.id,
      depth,
      content,
    },
  });
  const recipientId = parent?.authorId ?? post.authorId;
  await createNotification({
    type: parent ? "REPLY" : "COMMENT",
    recipientId,
    senderId: input.authorId,
    objectType: "Comment",
    objectId: comment.id,
    title: parent ? "Yeni yanıt" : "Yeni yorum",
    message: parent
      ? "Yorumunuza yeni bir yanıt eklendi."
      : "Yazınıza yeni bir yorum eklendi.",
    emailKey: parent ? "replyNotifications" : "commentNotifications",
  });
  return { comment, slug: post.slug };
}

export async function editComment(input: {
  commentId: string;
  actorId: string;
  content: string;
  context: RequestContext;
}) {
  const policy = await getCommentPolicy();
  const content = normalizeCommentContent(input.content, policy.maxLinks);
  const comment = await db.comment.findFirst({
    where: {
      id: input.commentId,
      authorId: input.actorId,
      status: "VISIBLE",
      deletedAt: null,
    },
    include: { post: { select: { slug: true } } },
  });
  if (!comment) throw new Error("Yorum bulunamadı.");
  if (
    new Date().getTime() - comment.createdAt.getTime() >
    policy.editWindowMs
  )
    throw new Error("Yorum düzenleme süresi dolmuş.");
  await db.$transaction([
    db.commentRevision.create({
      data: {
        commentId: comment.id,
        editorId: input.actorId,
        content: comment.content,
      },
    }),
    db.comment.update({
      where: { id: comment.id },
      data: { content, editedAt: new Date() },
    }),
    db.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "COMMENT_EDITED",
        targetType: "Comment",
        targetId: comment.id,
        ipAddress: input.context.ip,
        userAgent: input.context.userAgent,
      },
    }),
  ]);
  return comment.post.slug;
}

export async function deleteComment(input: {
  commentId: string;
  actorId: string;
  context: RequestContext;
}) {
  const comment = await db.comment.findFirst({
    where: { id: input.commentId, authorId: input.actorId, deletedAt: null },
    include: { post: { select: { slug: true } } },
  });
  if (!comment) throw new Error("Yorum bulunamadı.");
  await db.$transaction([
    db.comment.update({
      where: { id: comment.id },
      data: { content: "", deletedAt: new Date(), editedAt: null },
    }),
    db.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "COMMENT_DELETED",
        targetType: "Comment",
        targetId: comment.id,
        ipAddress: input.context.ip,
        userAgent: input.context.userAgent,
      },
    }),
  ]);
  return comment.post.slug;
}

export async function moderateComment(input: {
  commentId: string;
  moderatorId: string;
  reason: string;
  hide: boolean;
  context: RequestContext;
}) {
  if (input.reason.trim().length < 5)
    throw new Error("Moderasyon nedeni en az 5 karakter olmalıdır.");
  const comment = await db.comment.findUnique({
    where: { id: input.commentId },
    include: { post: { select: { slug: true } } },
  });
  if (!comment) throw new Error("Yorum bulunamadı.");
  await db.$transaction([
    db.comment.update({
      where: { id: comment.id },
      data: {
        status: input.hide ? "HIDDEN" : "VISIBLE",
        moderationReason: input.reason.trim(),
        moderatedById: input.moderatorId,
        moderatedAt: new Date(),
      },
    }),
    db.moderationAction.create({
      data: {
        actorId: input.moderatorId,
        action: input.hide ? "HIDE" : "RESTORE",
        targetType: "COMMENT",
        targetId: comment.id,
        reason: input.reason.trim(),
      },
    }),
    db.auditLog.create({
      data: {
        actorId: input.moderatorId,
        action: input.hide ? "COMMENT_HIDDEN" : "COMMENT_RESTORED",
        targetType: "Comment",
        targetId: comment.id,
        newValue: { reason: input.reason.trim() },
        ipAddress: input.context.ip,
        userAgent: input.context.userAgent,
      },
    }),
  ]);
  await createNotification({
    type: "MODERATION",
    recipientId: comment.authorId,
    senderId: input.moderatorId,
    objectType: "Comment",
    objectId: comment.id,
    title: input.hide ? "Yorumunuz gizlendi" : "Yorumunuz geri yüklendi",
    message: input.reason.trim(),
  });
  return comment.post.slug;
}

export async function toggleCommentLike(commentId: string, userId: string) {
  const comment = await db.comment.findFirst({
    where: { id: commentId, status: "VISIBLE", deletedAt: null },
    include: { post: { select: { slug: true } } },
  });
  if (!comment) throw new Error("Yorum bulunamadı.");
  await assertNotBlocked(userId, comment.authorId);
  const key = { commentId_userId: { commentId, userId } };
  const existing = await db.commentLike.findUnique({ where: key });
  if (existing) await db.commentLike.delete({ where: key });
  else {
    await db.commentLike.create({ data: { commentId, userId } });
    await createNotification({
      type: "COMMENT_LIKE",
      recipientId: comment.authorId,
      senderId: userId,
      objectType: "Comment",
      objectId: comment.id,
      title: "Yorumunuz beğenildi",
      message: "Bir kullanıcı yorumunuzu beğendi.",
    });
  }
  return comment.post.slug;
}
