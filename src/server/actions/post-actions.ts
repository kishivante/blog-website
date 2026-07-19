"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/authorization";
import { assertCsrfToken } from "@/server/csrf";
import { getRequestContext } from "@/server/request-context";
import { postFormSchema } from "@/validators/post";
import {
  restorePostRevision,
  reviewPost,
  savePost,
} from "@/services/post-service";
import type { FormState } from "@/types/forms";
import { db } from "@/server/db";
import { enforceRateLimit } from "@/server/rate-limit";

const failure = (error: unknown): FormState => ({
  error: error instanceof Error ? error.message : "İşlem tamamlanamadı.",
});
const permissionsOf = (session: Awaited<ReturnType<typeof requireUser>>) =>
  new Set(
    session.user.roles.flatMap(({ role }) =>
      role.permissions.map(({ permission }) => permission.key),
    ),
  );

export async function savePostAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  let postId = "";
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requireUser();
    const parsed = postFormSchema.safeParse({
      ...Object.fromEntries(form),
      id: String(form.get("id") ?? "") || undefined,
      tagIds: form.getAll("tagIds").map(String),
      allowComments: form.get("allowComments") === "on",
    });
    if (!parsed.success)
      return {
        error: "Yazı alanlarını kontrol edin.",
        fields: parsed.error.flatten().fieldErrors,
      };
    const context = await getRequestContext();
    if (parsed.data.intent === "submit")
      await enforceRateLimit("post-submit", context.ip, session.userId);
    const post = await savePost(
      session.userId,
      parsed.data,
      context,
    );
    postId = post.id;
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/taslaklar");
  redirect(`/yazi/${postId}/duzenle`);
}

export async function reviewPostAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requireUser();
    const permissions = permissionsOf(session);
    const decision = String(form.get("decision") ?? "");
    if (
      ![
        "APPROVED",
        "CHANGES_REQUESTED",
        "REJECTED",
        "PUBLISHED",
        "SCHEDULED",
      ].includes(decision)
    )
      return { error: "İnceleme kararı geçersiz." };
    if (!permissions.has("posts.review"))
      return { error: "Yazı inceleme yetkiniz yok." };
    if (
      ["APPROVED", "PUBLISHED", "SCHEDULED"].includes(decision) &&
      !permissions.has(
        decision === "APPROVED" ? "posts.approve" : "posts.publish",
      )
    )
      return { error: "Bu işlem için yayın yetkiniz yok." };
    const scheduledText = String(form.get("scheduledAt") ?? "");
    const scheduledAt = scheduledText ? new Date(scheduledText) : undefined;
    if (
      decision === "SCHEDULED" &&
      (!scheduledAt ||
        Number.isNaN(scheduledAt.getTime()) ||
        scheduledAt <= new Date())
    )
      return { error: "Gelecekte bir yayın zamanı seçin." };
    await reviewPost({
      postId: String(form.get("postId") ?? ""),
      reviewerId: session.userId,
      decision: decision as
        | "APPROVED"
        | "CHANGES_REQUESTED"
        | "REJECTED"
        | "PUBLISHED"
        | "SCHEDULED",
      note: String(form.get("note") ?? "")
        .trim()
        .slice(0, 2000),
      scheduledAt,
      allowSelfApprove: permissions.has("posts.admin_self_approve"),
      context: await getRequestContext(),
    });
    revalidatePath("/incelemedeki-yazilar");
    revalidatePath("/haberler");
    return { success: "İnceleme kararı kaydedildi." };
  } catch (error) {
    return failure(error);
  }
}

export async function restoreRevisionAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requireUser();
    await restorePostRevision(
      String(form.get("postId") ?? ""),
      String(form.get("revisionId") ?? ""),
      session.userId,
      Number(form.get("version")),
      permissionsOf(session).has("posts.review"),
      await getRequestContext(),
    );
    return { success: "Revizyon geri yüklendi ve yeniden incelemeye alındı." };
  } catch (error) {
    return failure(error);
  }
}

export async function archivePostAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requireUser();
    if (!permissionsOf(session).has("posts.publish"))
      return { error: "Yazı arşivleme yetkiniz yok." };
    const postId = String(form.get("postId") ?? "");
    const result = await db.post.updateMany({
      where: { id: postId, status: "PUBLISHED", deletedAt: null },
      data: { status: "ARCHIVED", version: { increment: 1 } },
    });
    if (!result.count) return { error: "Yayınlanmış yazı bulunamadı." };
    const context = await getRequestContext();
    await db.auditLog.create({
      data: {
        actorId: session.userId,
        action: "POST_ARCHIVED",
        targetType: "Post",
        targetId: postId,
        ipAddress: context.ip,
        userAgent: context.userAgent,
      },
    });
    revalidatePath("/haberler");
    return { success: "Yazı arşivlendi." };
  } catch (error) {
    return failure(error);
  }
}
