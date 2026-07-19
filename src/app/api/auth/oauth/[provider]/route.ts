import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/server/session";
import {
  createOAuthAuthorization,
  type OAuthProvider,
} from "@/services/oauth-service";
import { getServerEnv } from "@/lib/env";

function parseProvider(value: string): OAuthProvider {
  if (value !== "google" && value !== "github")
    throw new Error("Desteklenmeyen OAuth sağlayıcısı.");
  return value;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const provider = parseProvider((await params).provider);
    const session = await getSession();
    const mode = request.nextUrl.searchParams.get("mode");
    const intent =
      mode === "link" && session
        ? { mode: "link" as const, userId: session.userId }
        : { mode: "login" as const };
    return NextResponse.redirect(
      await createOAuthAuthorization(provider, intent),
    );
  } catch {
    return NextResponse.redirect(
      new URL("/giris?error=oauth", getServerEnv().APP_URL),
    );
  }
}
