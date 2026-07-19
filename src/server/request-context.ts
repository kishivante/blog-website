import { headers } from "next/headers";
import { getServerEnv } from "@/lib/env";

export type RequestContext = { ip: string; userAgent: string };

export async function getRequestContext(): Promise<RequestContext> {
  const values = await headers();
  const trustedHosts = new Set(
    getServerEnv()
      .TRUSTED_HOSTS.split(",")
      .map((item) => item.trim().toLowerCase()),
  );
  const host = (values.get("host") ?? "").split(":")[0]?.toLowerCase() ?? "";
  if (!trustedHosts.has(host)) throw new Error("Güvenilmeyen Host başlığı.");
  const proxyIp = values.get("x-real-ip");
  return {
    ip: proxyIp?.trim() || "unknown",
    userAgent: (values.get("user-agent") ?? "unknown").slice(0, 500),
  };
}
