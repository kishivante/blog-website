"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/authorization";
import { assertCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";

export async function markNotificationReadAction(form: FormData) {
  await assertCsrfToken(form.get("_csrf"));
  const session = await requireUser();
  await db.notification.updateMany({
    where: {
      id: String(form.get("notificationId") ?? ""),
      recipientId: session.userId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  revalidatePath("/bildirimler");
}

export async function markAllNotificationsReadAction(form: FormData) {
  await assertCsrfToken(form.get("_csrf"));
  const session = await requireUser();
  await db.notification.updateMany({
    where: { recipientId: session.userId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/bildirimler");
}
