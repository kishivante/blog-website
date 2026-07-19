"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/authorization";
import { assertCsrfToken } from "@/server/csrf";
import { enforceRateLimit } from "@/server/rate-limit";
import { getRequestContext } from "@/server/request-context";
import { createReport, resolveReport } from "@/services/report-service";
import { reportSchema } from "@/validators/report";
import type { FormState } from "@/types/forms";
import type { ModerationActionType } from "@prisma/client";

const errorState = (error: unknown): FormState => ({
  error: error instanceof Error ? error.message : "İşlem tamamlanamadı.",
});

export async function createReportAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requireUser();
    const context = await getRequestContext();
    await enforceRateLimit("report", context.ip, session.userId);
    const parsed = reportSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success)
      return {
        error: "Rapor alanlarını kontrol edin.",
        fields: parsed.error.flatten().fieldErrors,
      };
    await createReport({ reporterId: session.userId, ...parsed.data, context });
    return { success: "Raporunuz moderasyon ekibine iletildi." };
  } catch (error) {
    return errorState(error);
  }
}

export async function createReportDirectAction(form: FormData): Promise<void> {
  const result = await createReportAction({}, form);
  if (result.error) throw new Error(result.error);
}

export async function resolveReportAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await assertCsrfToken(form.get("_csrf"));
    const session = await requireUser();
    const permissions = new Set(
      session.user.roles.flatMap(({ role }) =>
        role.permissions.map(({ permission }) => permission.key),
      ),
    );
    if (!permissions.has("reports.manage"))
      return { error: "Rapor yönetme yetkiniz yok." };
    const status =
      form.get("status") === "DISMISSED" ? "DISMISSED" : "RESOLVED";
    const actionValue = String(form.get("moderationAction") ?? "");
    const allowed = [
      "WARN",
      "HIDE",
      "REMOVE",
      "SUSPEND",
    ];
    await resolveReport({
      reportId: String(form.get("reportId") ?? ""),
      moderatorId: session.userId,
      status,
      action: allowed.includes(actionValue)
        ? (actionValue as ModerationActionType)
        : undefined,
      resolution: String(form.get("resolution") ?? ""),
      context: await getRequestContext(),
    });
    revalidatePath("/admin/raporlar");
    return { success: "Rapor kararı kaydedildi." };
  } catch (error) {
    return errorState(error);
  }
}
