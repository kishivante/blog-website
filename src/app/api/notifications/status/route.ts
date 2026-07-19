import { NextResponse } from "next/server";
import { getSession } from "@/server/session";
import { db } from "@/server/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ unread: 0 }, { status: 401 });
  const [unread, latest] = await Promise.all([
    db.notification.count({
      where: {
        recipientId: session.userId,
        readAt: null,
        createdAt: { lte: new Date() },
      },
    }),
    db.notification.findFirst({
      where: { recipientId: session.userId, createdAt: { lte: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  return NextResponse.json(
    { unread, latest: latest?.createdAt.toISOString() ?? null },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
