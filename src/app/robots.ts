import type { MetadataRoute } from "next";
import { getPublicConfig } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = getPublicConfig().appUrl;
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/haberler/", "/konular/", "/wiki/"],
      disallow: [
        "/admin/",
        "/ayarlar/",
        "/yazi/",
        "/taslaklar",
        "/incelemedeki-yazilar",
        "/api/",
      ],
    },
    sitemap: new URL("/sitemap.xml", base).toString(),
    host: base,
  };
}
