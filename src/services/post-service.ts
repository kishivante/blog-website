import "server-only";
import { Prisma, type PostStatus, type ReviewDecision } from "@prisma/client";
import { db } from "@/server/db";
import { postRepository } from "@/repositories/post-repository";
import { renderPostContent } from "@/services/post-content-service";
import { getRedis } from "@/server/redis";
import type { RequestContext } from "@/server/request-context";
import { createNotification } from "@/services/notification-service";

export type SavePostInput = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: object;
  categoryId: string;
  tagIds: string[];
  seriesId: string;
  seriesOrder?: number;
  coverImage: string;
  bannerColor?: string;
  allowComments: boolean;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  version: number;
  intent: "draft" | "submit";
};

const json = (value: object) => value as Prisma.InputJsonValue;

async function audit(
  actorId: string,
  action: string,
  postId: string,
  context: RequestContext,
  newValue?: Prisma.InputJsonValue,
) {
  await db.auditLog.create({
    data: {
      actorId,
      action,
      targetType: "Post",
      targetId: postId,
      newValue,
      ipAddress: context.ip,
      userAgent: context.userAgent,
    },
  });
}

export async function savePost(
  authorId: string,
  input: SavePostInput,
  context: RequestContext,
) {
  const rendered = renderPostContent(input.content);
  if (rendered.wordCount < 1) throw new Error("Yazı içeriği boş olamaz.");
  const duplicate = await db.post.findFirst({
    where: { slug: input.slug, ...(input.id ? { id: { not: input.id } } : {}) },
    select: { id: true },
  });
  const redirectDuplicate = await db.postSlugRedirect.findUnique({
    where: { oldSlug: input.slug },
    select: { id: true },
  });
  if (duplicate || redirectDuplicate)
    throw new Error("Bu slug daha önce kullanılmış.");
  const common = {
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt || null,
    content: json(input.content),
    renderedContent: rendered.renderedContent,
    coverImage: input.coverImage || null,
    bannerSettings: input.bannerColor
      ? { color: input.bannerColor }
      : Prisma.JsonNull,
    allowComments: input.allowComments,
    readingTimeMinutes: rendered.readingTimeMinutes,
    seriesId: input.seriesId || null,
    seriesOrder: input.seriesId ? (input.seriesOrder ?? null) : null,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    canonicalUrl: input.canonicalUrl || null,
  };
  if (!input.id) {
    const post = await db.post.create({
      data: {
        ...common,
        authorId,
        status: input.intent === "submit" ? "PENDING_REVIEW" : "DRAFT",
        categories: input.categoryId
          ? { create: { categoryId: input.categoryId, isPrimary: true } }
          : undefined,
        tags: input.tagIds.length
          ? {
              createMany: {
                data: input.tagIds.map((tagId) => ({ tagId })),
                skipDuplicates: true,
              },
            }
          : undefined,
        reviews:
          input.intent === "submit"
            ? {
                create: {
                  decision: "SUBMITTED",
                  note: "Yazar incelemeye gönderdi.",
                },
              }
            : undefined,
      },
    });
    await audit(
      authorId,
      input.intent === "submit" ? "POST_SUBMITTED" : "POST_CREATED",
      post.id,
      context,
    );
    return post;
  }
  const current = await db.post.findUnique({ where: { id: input.id } });
  if (!current || current.deletedAt) throw new Error("Yazı bulunamadı.");
  if (current.authorId !== authorId)
    throw new Error("Bu yazıyı düzenleme yetkiniz yok.");
  if (
    ![
      "DRAFT",
      "CHANGES_REQUESTED",
      "REJECTED",
      "PUBLISHED",
      "APPROVED",
    ].includes(current.status)
  )
    throw new Error("Bu durumdaki yazı düzenlenemez.");
  const status: PostStatus =
    input.intent === "submit"
      ? "PENDING_REVIEW"
      : current.status === "PUBLISHED"
        ? "PENDING_REVIEW"
        : "DRAFT";
  const revisionNumber = current.revisionNumber + 1;
  await db.$transaction(async (tx) => {
    const updated = await tx.post.updateMany({
      where: { id: current.id, version: input.version },
      data: {
        ...common,
        status,
        reviewerId: null,
        requestedChanges: null,
        rejectionReason: null,
        version: { increment: 1 },
        revisionNumber,
      },
    });
    if (updated.count !== 1)
      throw new Error(
        "Yazı başka bir oturumda güncellendi. Sayfayı yenileyip değişikliklerinizi birleştirin.",
      );
    await tx.postRevision.create({
      data: {
        postId: current.id,
        revisionNumber,
        editorId: authorId,
        title: current.title,
        excerpt: current.excerpt,
        content: current.content as Prisma.InputJsonValue,
        renderedContent: current.renderedContent,
        changeSummary:
          current.status === "PUBLISHED"
            ? "Yayın sonrası kontrollü revizyon"
            : "Önceki düzenleme sürümü",
      },
    });
    if (current.slug !== input.slug)
      await tx.postSlugRedirect.upsert({
        where: { oldSlug: current.slug },
        update: { postId: current.id },
        create: { postId: current.id, oldSlug: current.slug },
      });
    await tx.postCategory.deleteMany({ where: { postId: current.id } });
    if (input.categoryId)
      await tx.postCategory.create({
        data: {
          postId: current.id,
          categoryId: input.categoryId,
          isPrimary: true,
        },
      });
    await tx.postTag.deleteMany({ where: { postId: current.id } });
    if (input.tagIds.length)
      await tx.postTag.createMany({
        data: input.tagIds.map((tagId) => ({ postId: current.id, tagId })),
        skipDuplicates: true,
      });
    if (input.intent === "submit" || current.status === "PUBLISHED")
      await tx.postReview.create({
        data: {
          postId: current.id,
          decision: "SUBMITTED",
          note:
            current.status === "PUBLISHED"
              ? "Yayınlanan içerik değişti; yeniden inceleme gerekiyor."
              : "Yazar incelemeye gönderdi.",
        },
      });
  });
  await audit(
    authorId,
    input.intent === "submit" ? "POST_SUBMITTED" : "POST_UPDATED",
    current.id,
    context,
    { version: input.version + 1 },
  );
  return db.post.findUniqueOrThrow({ where: { id: current.id } });
}

export async function reviewPost(input: {
  postId: string;
  reviewerId: string;
  decision:
    | "APPROVED"
    | "CHANGES_REQUESTED"
    | "REJECTED"
    | "PUBLISHED"
    | "SCHEDULED";
  note: string;
  scheduledAt?: Date;
  allowSelfApprove: boolean;
  context: RequestContext;
}) {
  const post = await db.post.findUnique({ where: { id: input.postId } });
  if (!post || post.deletedAt) throw new Error("Yazı bulunamadı.");
  if (post.authorId === input.reviewerId && !input.allowSelfApprove)
    throw new Error("Yazar kendi yazısını onaylayamaz.");
  if (!["PENDING_REVIEW", "APPROVED"].includes(post.status))
    throw new Error("Yazı incelemeye uygun durumda değil.");
  if (
    ["PUBLISHED", "SCHEDULED"].includes(input.decision) &&
    post.status !== "APPROVED"
  )
    throw new Error("Yazı yayınlanmadan önce onaylanmalıdır.");
  const status = input.decision as PostStatus;
  const reviewDecision =
    input.decision === "SCHEDULED"
      ? "APPROVED"
      : (input.decision as ReviewDecision);
  const now = new Date();
  await db.$transaction([
    db.post.update({
      where: { id: post.id },
      data: {
        status,
        reviewerId: input.reviewerId,
        requestedChanges:
          input.decision === "CHANGES_REQUESTED" ? input.note : null,
        rejectionReason: input.decision === "REJECTED" ? input.note : null,
        scheduledPublishAt:
          input.decision === "SCHEDULED" ? input.scheduledAt : null,
        publishedAt:
          input.decision === "PUBLISHED"
            ? (post.publishedAt ?? now)
            : post.publishedAt,
        version: { increment: 1 },
      },
    }),
    db.postReview.create({
      data: {
        postId: post.id,
        reviewerId: input.reviewerId,
        decision: reviewDecision,
        note: input.note || null,
      },
    }),
    db.auditLog.create({
      data: {
        actorId: input.reviewerId,
        action: `POST_${input.decision}`,
        targetType: "Post",
        targetId: post.id,
        newValue: { note: input.note },
        ipAddress: input.context.ip,
        userAgent: input.context.userAgent,
      },
    }),
  ]);
  await createNotification({
    type: "REVIEW",
    recipientId: post.authorId,
    senderId: input.reviewerId,
    objectType: "Post",
    objectId: post.id,
    title: `Yazı durumu: ${input.decision}`,
    message: input.note || "Yazınızın inceleme durumu güncellendi.",
    emailKey: "reviewNotifications",
  });
  if (input.decision === "SCHEDULED" && input.scheduledAt)
    await (
      await getRedis()
    ).zAdd("scheduled:posts", [
      { score: input.scheduledAt.getTime(), value: post.id },
    ]);
}

export async function restorePostRevision(
  postId: string,
  revisionId: string,
  actorId: string,
  version: number,
  allowManage: boolean,
  context: RequestContext,
) {
  const [post, revision] = await Promise.all([
    db.post.findUnique({ where: { id: postId } }),
    db.postRevision.findFirst({ where: { id: revisionId, postId } }),
  ]);
  if (!post || !revision) throw new Error("Revizyon bulunamadı.");
  if (post.authorId !== actorId && !allowManage)
    throw new Error("Bu yazının revizyonlarını geri yükleme yetkiniz yok.");
  const nextRevision = post.revisionNumber + 1;
  const result = await db.post.updateMany({
    where: { id: postId, version },
    data: {
      title: revision.title,
      excerpt: revision.excerpt,
      content: revision.content as Prisma.InputJsonValue,
      renderedContent: revision.renderedContent,
      status: "PENDING_REVIEW",
      revisionNumber: nextRevision,
      version: { increment: 1 },
    },
  });
  if (!result.count) throw new Error("Yazı başka bir oturumda güncellendi.");
  await db.postRevision.create({
    data: {
      postId,
      revisionNumber: nextRevision,
      editorId: actorId,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content as Prisma.InputJsonValue,
      renderedContent: post.renderedContent,
      restoredFromId: revision.id,
      changeSummary: "Önceki sürüme geri dönüldü.",
    },
  });
  await audit(actorId, "POST_REVISION_RESTORED", postId, context, {
    revisionId,
  });
}

export const postService = {
  getHomeFeed: () => postRepository.listPublished(12),
  getBySlug: (slug: string) => postRepository.findPublishedBySlug(slug),
};
