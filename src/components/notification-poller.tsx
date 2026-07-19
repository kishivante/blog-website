"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function NotificationPoller({ latest }: { latest: string | null }) {
  const router = useRouter();
  const known = useRef(latest);
  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const response = await fetch("/api/notifications/status", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as { latest: string | null };
      if (data.latest && known.current && data.latest !== known.current)
        router.refresh();
      known.current = data.latest;
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}
