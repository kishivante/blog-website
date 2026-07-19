"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/server/authorization";
import { assertCsrfToken } from "@/server/csrf";
import { getRequestContext } from "@/server/request-context";
import {
  restoreWikiRevision,
  saveWikiPage,
  setWikiDeleted,
  WikiConflictError,
} from "@/services/wiki-service";
import { wikiFormSchema } from "@/validators/wiki";
import type { FormState } from "@/types/forms";

const failure = (error: unknown): FormState => ({
  error: error instanceof Error ? error.message : "İşlem tamamlanamadı.",
});

export async function saveWikiAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  let id = "";
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requirePermission("wiki.edit");
    const parsed = wikiFormSchema.safeParse({
      ...Object.fromEntries(form),
      id: String(form.get("id") ?? "") || undefined,
      tagIds: form.getAll("tagIds").map(String),
      linkedPageIds: form.getAll("linkedPageIds").map(String),
      locked: form.get("locked") === "on",
    });
    if (!parsed.success) {
      return {
        error: "Wiki alanlarını kontrol edin.",
        fields: parsed.error.flatten().fieldErrors,
      };
    }
    const permissions = new Set(
      session.user.roles.flatMap(({ role }) =>
        role.permissions.map(({ permission }) => permission.key),
      ),
    );
    if (
      parsed.data.status === "PUBLISHED" &&
      !permissions.has("wiki.publish")
    ) {
      return { error: "Wiki yayınlama yetkiniz yok." };
    }
    id = await saveWikiPage(
      session.userId,
      parsed.data,
      await getRequestContext(),
    );
  } catch (error) {
    if (error instanceof WikiConflictError) {
      return {
        error: error.message,
        fields: {
          _serverTitle: [error.currentTitle],
          _serverContent: [error.currentText],
        },
      };
    }
    return failure(error);
  }
  revalidatePath("/wiki");
  revalidatePath("/admin/wiki");
  redirect(`/admin/wiki/${id}`);
}

export async function restoreWikiRevisionAction(form: FormData): Promise<void> {
  await assertCsrfToken(form.get("_csrf"));
  const session = await requirePermission("wiki.edit");
  const pageId = String(form.get("pageId") ?? "");
  await restoreWikiRevision({
    pageId,
    revisionId: String(form.get("revisionId") ?? ""),
    actorId: session.userId,
    expectedVersion: Number(form.get("version")),
    context: await getRequestContext(),
  });
  revalidatePath(`/admin/wiki/${pageId}`);
  revalidatePath("/wiki");
}

export async function setWikiDeletedAction(form: FormData): Promise<void> {
  await assertCsrfToken(form.get("_csrf"));
  const session = await requirePermission("wiki.edit");
  const pageId = String(form.get("pageId") ?? "");
  await setWikiDeleted({
    pageId,
    actorId: session.userId,
    restore: form.get("intent") === "restore",
    context: await getRequestContext(),
  });
  revalidatePath(`/admin/wiki/${pageId}`);
  revalidatePath("/admin/wiki");
  revalidatePath("/wiki");
}
