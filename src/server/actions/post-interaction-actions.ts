"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/authorization";
import { assertCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";
import { enforceRateLimit } from "@/server/rate-limit";
import { getRequestContext } from "@/server/request-context";
import {
  createComment,
  deleteComment,
  editComment,
  moderateComment,
  toggleCommentLike,
} from "@/services/comment-service";
import { createNotification } from "@/services/notification-service";

async function authorizedPost(postId: string) {
  const post = await db.post.findFirst({
    where: { id: postId, status: "PUBLISHED", deletedAt: null },
    select: { id: true, authorId: true, slug: true },
  });
  if (!post) throw new Error("Yazı bulunamadı.");
  return post;
}

export async function togglePostLikeAction(form: FormData) {
  await assertCsrfToken(form.get("_csrf"));
  const session = await requireUser();
  const context = await getRequestContext();
  await enforceRateLimit("interaction", context.ip, session.userId);
  const post = await authorizedPost(String(form.get("postId") ?? ""));
  const key = { postId_userId: { postId: post.id, userId: session.userId } };
  const existing = await db.postLike.findUnique({ where: key });
  if (existing) await db.postLike.delete({ where: key });
  else {
    await db.postLike.create({
      data: { postId: post.id, userId: session.userId },
    });
    await createNotification({
      type: "POST_LIKE",
      recipientId: post.authorId,
      senderId: session.userId,
      objectType: "Post",
      objectId: post.id,
      title: "Yazınız beğenildi",
      message: "Bir kullanıcı yazınızı beğendi.",
    });
  }
  revalidatePath(`/haberler/${post.slug}`);
}

export async function toggleBookmarkAction(form: FormData) {
  await assertCsrfToken(form.get("_csrf"));
  const session = await requireUser();
  const post = await authorizedPost(String(form.get("postId") ?? ""));
  const key = { postId_userId: { postId: post.id, userId: session.userId } };
  const existing = await db.postBookmark.findUnique({ where: key });
  if (existing) await db.postBookmark.delete({ where: key });
  else
    await db.postBookmark.create({
      data: { postId: post.id, userId: session.userId },
    });
  revalidatePath(`/haberler/${post.slug}`);
}

export async function createCommentAction(form: FormData) {
  await assertCsrfToken(form.get("_csrf"));
  const session = await requireUser();
  const context = await getRequestContext();
  await enforceRateLimit("comment", context.ip, session.userId);
  const result = await createComment({
    postId: String(form.get("postId") ?? ""),
    authorId: session.userId,
    parentId: String(form.get("parentId") ?? "") || undefined,
    content: String(form.get("content") ?? ""),
    context,
  });
  revalidatePath(`/haberler/${result.slug}`);
}

export async function editCommentAction(form: FormData) {
  await assertCsrfToken(form.get("_csrf"));
  const session = await requireUser();
  const slug = await editComment({
    commentId: String(form.get("commentId") ?? ""),
    actorId: session.userId,
    content: String(form.get("content") ?? ""),
    context: await getRequestContext(),
  });
  revalidatePath(`/haberler/${slug}`);
}

export async function deleteCommentAction(form: FormData) {
  await assertCsrfToken(form.get("_csrf"));
  const session = await requireUser();
  const slug = await deleteComment({
    commentId: String(form.get("commentId") ?? ""),
    actorId: session.userId,
    context: await getRequestContext(),
  });
  revalidatePath(`/haberler/${slug}`);
}

export async function toggleCommentLikeAction(form: FormData) {
  await assertCsrfToken(form.get("_csrf"));
  const session = await requireUser();
  const slug = await toggleCommentLike(
    String(form.get("commentId") ?? ""),
    session.userId,
  );
  revalidatePath(`/haberler/${slug}`);
}

export async function moderateCommentAction(form: FormData) {
  await assertCsrfToken(form.get("_csrf"));
  const session = await requireUser();
  const permissions = new Set(
    session.user.roles.flatMap(({ role }) =>
      role.permissions.map(({ permission }) => permission.key),
    ),
  );
  if (!permissions.has("comments.moderate"))
    throw new Error("Yorum moderasyon yetkiniz yok.");
  const slug = await moderateComment({
    commentId: String(form.get("commentId") ?? ""),
    moderatorId: session.userId,
    reason: String(form.get("reason") ?? ""),
    hide: form.get("intent") === "hide",
    context: await getRequestContext(),
  });
  revalidatePath(`/haberler/${slug}`);
}
