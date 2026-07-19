import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getSession } from "@/server/session";
import { getServerEnv } from "@/lib/env";
import { getStorageAdapter } from "@/storage";
import { assertStorageKey } from "@/storage/storage-adapter";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const segments = (await params).path;
  const key = segments.join("/");
  try {
    assertStorageKey(key);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  const asset = await db.uploadAsset.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { storageKey: key },
        { variants: { path: ["thumbnail"], equals: key } },
        { variants: { path: ["main"], equals: key } },
      ],
    },
    select: { ownerId: true, visibility: true, mimeType: true },
  });
  if (!asset) return new NextResponse(null, { status: 404 });
  if (asset.visibility === "private") {
    const session = await getSession();
    const permissions =
      session?.user.roles.flatMap(({ role }) =>
        role.permissions.map(({ permission }) => permission.key),
      ) ?? [];
    if (
      !session ||
      (session.userId !== asset.ownerId &&
        !permissions.includes("admin.access"))
    ) {
      return new NextResponse(null, { status: 404 });
    }
  }
  const storage = getStorageAdapter();
  const env = getServerEnv();
  if (
    storage.driver === "s3" &&
    env.S3_PRIVATE_BUCKET &&
    new URL(request.url).searchParams.get("proxy") !== "1"
  ) {
    return NextResponse.redirect(
      await storage.signedUrl(key, env.S3_SIGNED_URL_TTL_SECONDS),
      307,
    );
  }
  const object = await storage.get(key);
  if (!object) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(object.body), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(object.contentLength ?? object.body.byteLength),
      "Content-Disposition": object.contentDisposition ?? "inline",
      "Cache-Control":
        asset.visibility === "public"
          ? "public, max-age=31536000, immutable"
          : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-site",
    },
  });
}
