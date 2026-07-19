import { NextResponse } from "next/server";
import { getSession } from "@/server/session";
import { assertCsrfToken } from "@/server/csrf";
import { getRequestContext } from "@/server/request-context";
import { enforceRateLimit } from "@/server/rate-limit";
import { storePostImage } from "@/services/upload-service";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
    const form = await request.formData();
    await assertCsrfToken(form.get("_csrf"));
    const context = await getRequestContext();
    await enforceRateLimit("upload", context.ip, session.userId);
    const file = form.get("file");
    const kind = form.get("kind") === "cover" ? "cover" : "content";
    if (!(file instanceof File))
      return NextResponse.json({ error: "Dosya gerekli." }, { status: 400 });
    const wiki = form.get("scope") === "wiki";
    const url = await storePostImage(file, session.userId, kind, context, wiki);
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload başarısız." },
      { status: 400 },
    );
  }
}
