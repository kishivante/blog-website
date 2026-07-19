import { NextResponse } from "next/server";
import { getSession } from "@/server/session";
import { assertCsrfToken } from "@/server/csrf";
import { getRequestContext } from "@/server/request-context";
import { db } from "@/server/db";
import { renderPostContent } from "@/services/post-content-service";
import { Prisma } from "@prisma/client";
import type { JSONContent } from "@tiptap/core";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
    const body = (await request.json()) as {
      _csrf?: string;
      id?: string;
      title?: string;
      slug?: string;
      content?: JSONContent;
      version?: number;
    };
    await assertCsrfToken(body._csrf ?? null);
    if (
      !body.id ||
      !body.content ||
      typeof body.content !== "object" ||
      Array.isArray(body.content)
    )
      return NextResponse.json({ error: "Geçersiz taslak." }, { status: 400 });
    const post = await db.post.findFirst({
      where: { id: body.id, authorId: session.userId, deletedAt: null },
    });
    if (
      !post ||
      !["DRAFT", "CHANGES_REQUESTED", "REJECTED"].includes(post.status)
    )
      return NextResponse.json(
        { error: "Taslak otomatik kaydedilemez." },
        { status: 403 },
      );
    const rendered = renderPostContent(body.content);
    const updated = await db.post.updateMany({
      where: { id: post.id, version: body.version },
      data: {
        title: String(body.title ?? post.title).slice(0, 180),
        slug: String(body.slug ?? post.slug).slice(0, 160),
        content: body.content as Prisma.InputJsonValue,
        renderedContent: rendered.renderedContent,
        readingTimeMinutes: rendered.readingTimeMinutes,
        version: { increment: 1 },
      },
    });
    if (!updated.count)
      return NextResponse.json({ error: "Sürüm çakışması." }, { status: 409 });
    const context = await getRequestContext();
    await db.auditLog.create({
      data: {
        actorId: session.userId,
        action: "POST_AUTOSAVED",
        targetType: "Post",
        targetId: post.id,
        ipAddress: context.ip,
        userAgent: context.userAgent,
      },
    });
    return NextResponse.json({ version: (body.version ?? 1) + 1 });
  } catch {
    return NextResponse.json(
      { error: "Otomatik kayıt başarısız." },
      { status: 400 },
    );
  }
}
