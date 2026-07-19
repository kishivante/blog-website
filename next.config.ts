import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  async headers() {
    const securityHeaders = [
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://accounts.google.com https://github.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com https://github.com" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "X-Frame-Options", value: "DENY" }
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/giris", headers: [{ key: "Cache-Control", value: "no-store, private" }] },
      { source: "/kayit", headers: [{ key: "Cache-Control", value: "no-store, private" }] },
      { source: "/ayarlar/:path*", headers: [{ key: "Cache-Control", value: "no-store, private" }] },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store, private" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/bildirimler", headers: [{ key: "Cache-Control", value: "no-store, private" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/taslaklar", headers: [{ key: "Cache-Control", value: "no-store, private" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/incelemedeki-yazilar", headers: [{ key: "Cache-Control", value: "no-store, private" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/yazi/:path*", headers: [{ key: "Cache-Control", value: "no-store, private" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/api/auth/:path*", headers: [{ key: "Cache-Control", value: "no-store, private" }] }
    ];
  }
};

export default nextConfig;
