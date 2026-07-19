import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { sha256 } from "@/lib/crypto";

const sessionCookie = "__Host-scarlet_session";
let maintenanceCache: { enabled: boolean; expiresAt: number } | undefined;

async function maintenanceEnabled(): Promise<boolean> {
  if (maintenanceCache && maintenanceCache.expiresAt > Date.now())
    return maintenanceCache.enabled;
  try {
    const site = await db.siteSetting.findUnique({
      where: { id: "default" },
      select: { maintenanceMode: true },
    });
    maintenanceCache = {
      enabled: site?.maintenanceMode ?? false,
      expiresAt: Date.now() + 5_000,
    };
    return maintenanceCache.enabled;
  } catch {
    return false;
  }
}

async function isAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return false;
  const session = await db.session.findFirst({
    where: {
      tokenHash: sha256(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
      user: {
        accountStatus: "ACTIVE",
        deletedAt: null,
        roles: { some: { role: { code: "ADMIN" } } },
      },
    },
    select: { id: true },
  });
  return Boolean(session);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (
    pathname === "/health" ||
    pathname === "/giris" ||
    pathname === "/iki-adimli-dogrulama" ||
    pathname.startsWith("/api/auth/")
  )
    return NextResponse.next();
  if (!(await maintenanceEnabled()) || (await isAdmin(request)))
    return NextResponse.next();
  return new NextResponse(
    "<!doctype html><html lang=\"tr\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>Bakım çalışması</title><body><main><h1>Planlı bakım çalışması</h1><p>Site kısa süre içinde yeniden erişilebilir olacaktır.</p></main></body></html>",
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "300",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|api/uploads/|\\.well-known/).*)",
  ],
};
