import type { NotificationType } from "@prisma/client";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Pagination } from "@/components/ui/primitives";
import { NotificationPoller } from "@/components/notification-poller";
import { requireUser } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/actions/notification-actions";

const filters = [
  "ALL",
  "FOLLOW",
  "POST_LIKE",
  "COMMENT_LIKE",
  "COMMENT",
  "REPLY",
  "REVIEW",
  "MODERATION",
  "WIKI",
  "ROLE",
  "BADGE",
  "SYSTEM",
  "SECURITY",
] as const;
const targetHref = (item: {
  objectType: string | null;
  sender?: { username: string } | null;
}): "/haberler" | "/bildirimler" | `/kullanici/${string}` =>
  item.objectType === "Post"
    ? "/haberler"
    : item.objectType === "User" && item.sender
      ? `/kullanici/${item.sender.username}`
      : "/bildirimler";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const session = await requireUser();
  const query = await searchParams;
  const filter = filters.includes(query.filter as (typeof filters)[number])
    ? (query.filter as (typeof filters)[number])
    : "ALL";
  const page = Math.max(1, Number(query.page) || 1);
  const take = 20;
  const where = {
    recipientId: session.userId,
    createdAt: { lte: new Date() },
    ...(filter !== "ALL" ? { type: filter as NotificationType } : {}),
  };
  const [items, total, unread] = await Promise.all([
    db.notification.findMany({
      where,
      include: {
        sender: { select: { username: true, displayName: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    db.notification.count({ where }),
    db.notification.count({
      where: {
        recipientId: session.userId,
        readAt: null,
        createdAt: { lte: new Date() },
      },
    }),
  ]);
  const csrf = await createCsrfToken();
  return (
    <PageShell
      title="Bildirim merkezi"
      description={`${unread} okunmamış bildirim`}
    >
      <NotificationPoller latest={items[0]?.createdAt.toISOString() ?? null} />
      <div className="notificationTools">
        <nav aria-label="Bildirim filtreleri">
          {filters.map((value) => (
            <Link
              key={value}
              aria-current={filter === value ? "page" : undefined}
              href={{ pathname: "/bildirimler", query: { filter: value } }}
            >
              {value}
            </Link>
          ))}
        </nav>
        {unread ? (
          <form action={markAllNotificationsReadAction}>
            <input type="hidden" name="_csrf" value={csrf} />
            <button className="quietButton">Tümünü okundu yap</button>
          </form>
        ) : null}
      </div>
      {items.length ? (
        <div className="notificationList">
          {items.map((item) => (
            <article key={item.id} data-read={Boolean(item.readAt)}>
              <div>
                <span className="uiBadge uiBadge--azure">{item.type}</span>
                <h2>{item.title}</h2>
                <p>{item.message}</p>
                <small>{item.createdAt.toLocaleString("tr-TR")}</small>
              </div>
              <div className="notificationActions">
                <Link href={targetHref(item)}>Aç</Link>
                {!item.readAt ? (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="_csrf" value={csrf} />
                    <input
                      type="hidden"
                      name="notificationId"
                      value={item.id}
                    />
                    <button className="quietButton">Okundu</button>
                  </form>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Bildirim yok"
          description="Bu filtreye ait bildirim bulunmuyor."
        />
      )}
      <Pagination
        page={page}
        hasNext={page * take < total}
        basePath="/bildirimler"
        query={{ filter }}
      />
    </PageShell>
  );
}
