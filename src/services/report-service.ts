import "server-only";
import type {
  ModerationActionType,
  ReportStatus,
  ReportTargetType,
} from "@prisma/client";
import { db } from "@/server/db";
import { sha256 } from "@/lib/crypto";
import type { RequestContext } from "@/server/request-context";
import { createNotification } from "@/services/notification-service";
import { assertUserCanDisable } from "@/services/profile-service";

export async function createReport(input: {
  reporterId: string;
  targetType: "POST" | "COMMENT" | "USER";
  targetId: string;
  reason: string;
  details: string;
  context: RequestContext;
}) {
  if (input.targetType === "USER" && input.targetId === input.reporterId)
    throw new Error("Kendi hesabınızı raporlayamazsınız.");
  const targetExists =
    input.targetType === "POST"
      ? await db.post.findFirst({
          where: { id: input.targetId, status: "PUBLISHED", deletedAt: null },
          select: { id: true },
        })
      : input.targetType === "COMMENT"
        ? await db.comment.findFirst({
            where: { id: input.targetId, deletedAt: null },
            select: { id: true },
          })
        : await db.user.findFirst({
            where: { id: input.targetId, deletedAt: null },
            select: { id: true },
          });
  if (!targetExists) throw new Error("Raporlanan içerik bulunamadı.");
  const base = sha256(
    `${input.reporterId}:${input.targetType}:${input.targetId}`,
  );
  const existing = await db.report.findFirst({
    where: {
      reporterId: input.reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      status: { in: ["OPEN", "IN_REVIEW"] },
    },
  });
  if (existing) throw new Error("Bu hedef için zaten açık bir raporunuz var.");
  const previous = await db.report.findUnique({ where: { dedupeKey: base } });
  const dedupeKey = previous
    ? sha256(`${base}:${new Date().toISOString()}`)
    : base;
  const report = await db.report.create({
    data: {
      reporterId: input.reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      details: input.details || null,
      dedupeKey,
    },
  });
  await db.auditLog.create({
    data: {
      actorId: input.reporterId,
      action: "REPORT_CREATED",
      targetType: "Report",
      targetId: report.id,
      newValue: {
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
      },
      ipAddress: input.context.ip,
      userAgent: input.context.userAgent,
    },
  });
  return report;
}

export async function resolveReport(input: {
  reportId: string;
  moderatorId: string;
  status: "RESOLVED" | "DISMISSED";
  action?: ModerationActionType;
  resolution: string;
  context: RequestContext;
}) {
  if (input.resolution.trim().length < 5)
    throw new Error("Karar açıklaması en az 5 karakter olmalıdır.");
  const report = await db.report.findUnique({ where: { id: input.reportId } });
  if (!report || !["OPEN", "IN_REVIEW"].includes(report.status))
    throw new Error("Açık rapor bulunamadı.");
  if (
    input.action &&
    !(
      input.action === "WARN" ||
      (["HIDE", "REMOVE"].includes(input.action) &&
        ["POST", "COMMENT"].includes(report.targetType)) ||
      (input.action === "SUSPEND" && report.targetType === "USER")
    )
  )
    throw new Error("Seçilen moderasyon işlemi bu rapor hedefiyle uyumlu değil.");
  if (input.action === "SUSPEND" && report.targetType === "USER")
    await assertUserCanDisable(report.targetId);
  await db.$transaction(async (tx) => {
    await tx.report.update({
      where: { id: report.id },
      data: {
        status: input.status as ReportStatus,
        resolution: input.resolution.trim(),
        assigneeId: input.moderatorId,
        resolvedAt: new Date(),
      },
    });
    if (input.action)
      await tx.moderationAction.create({
        data: {
          actorId: input.moderatorId,
          reportId: report.id,
          action: input.action,
          targetType: report.targetType as ReportTargetType,
          targetId: report.targetId,
          reason: input.resolution.trim(),
        },
      });
    if (
      input.action &&
      ["HIDE", "REMOVE"].includes(input.action) &&
      report.targetType === "COMMENT"
    )
      await tx.comment.update({
        where: { id: report.targetId },
        data: {
          status: "HIDDEN",
          moderationReason: input.resolution.trim(),
          moderatedById: input.moderatorId,
          moderatedAt: new Date(),
        },
      });
    if (
      input.action &&
      ["HIDE", "REMOVE"].includes(input.action) &&
      report.targetType === "POST"
    )
      await tx.post.update({
        where: { id: report.targetId },
        data: { status: "ARCHIVED", version: { increment: 1 } },
      });
    if (input.action === "SUSPEND" && report.targetType === "USER") {
      await tx.user.update({
        where: { id: report.targetId },
        data: {
          accountStatus: "SUSPENDED",
          suspendedAt: new Date(),
          suspensionReason: input.resolution.trim(),
        },
      });
      await tx.session.updateMany({
        where: { userId: report.targetId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "moderation_suspension" },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: input.moderatorId,
        action: "REPORT_RESOLVED",
        targetType: "Report",
        targetId: report.id,
        previousValue: { status: report.status },
        newValue: {
          status: input.status,
          action: input.action,
          resolution: input.resolution.trim(),
        },
        ipAddress: input.context.ip,
        userAgent: input.context.userAgent,
      },
    });
  });
  if (input.action === "WARN") {
    const targetUserId =
      report.targetType === "USER"
        ? report.targetId
        : report.targetType === "POST"
          ? (
              await db.post.findUnique({
                where: { id: report.targetId },
                select: { authorId: true },
              })
            )?.authorId
          : (
              await db.comment.findUnique({
                where: { id: report.targetId },
                select: { authorId: true },
              })
            )?.authorId;
    if (targetUserId)
      await createNotification({
        type: "MODERATION",
        recipientId: targetUserId,
        senderId: input.moderatorId,
        objectType: report.targetType,
        objectId: report.targetId,
        title: "Moderasyon uyarısı",
        message: input.resolution.trim(),
      });
  }
  await createNotification({
    type: "MODERATION",
    recipientId: report.reporterId,
    senderId: input.moderatorId,
    objectType: "Report",
    objectId: report.id,
    title: "Raporunuz sonuçlandı",
    message: input.resolution.trim(),
  });
}
