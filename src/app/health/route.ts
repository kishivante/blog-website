import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getRedis } from "@/server/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    const redis = await getRedis();
    await redis.ping();
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "unhealthy" }, { status: 503 });
  }
}
