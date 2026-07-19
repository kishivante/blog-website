import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getPublicConfig } from "@/lib/env";
import { getSitePresentation, themeStyle } from "@/services/site-service";
import "./globals.css";

const config = getPublicConfig();

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getSitePresentation();
  const name = site?.siteTitle ?? config.appName;
  return {
    metadataBase: new URL(site?.canonicalUrl ?? config.appUrl),
    title: { default: name, template: `%s | ${name}` },
    description:
      site?.siteDescription ??
      "Teknoloji, bilim ve gelecek üzerine bağımsız yayın.",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { site, theme } = await getSitePresentation();
  const socialLinks =
    site?.socialLinks &&
    typeof site.socialLinks === "object" &&
    !Array.isArray(site.socialLinks)
      ? Object.fromEntries(
          Object.entries(site.socialLinks).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {};
  return (
    <html lang={config.locale}>
      <body style={themeStyle(theme)}>
        <a className="skipLink" href="#main-content">
          İçeriğe geç
        </a>
        <SiteHeader />
        {children}
        <SiteFooter
          brandName={site?.brandName ?? config.appName}
          description={
            site?.siteDescription ??
            "Teknoloji, bilim ve gelecek üzerine bağımsız yayın."
          }
          footerText={site?.footerText ?? null}
          socialLinks={socialLinks}
          contactEmail={site?.contactEmail ?? ""}
          logo={site?.logo ?? "/brand/logo.png"}
        />
      </body>
    </html>
  );
}
