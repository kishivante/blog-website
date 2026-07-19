import type { CSSProperties } from "react";
import { db } from "@/server/db";

const fallbackTheme = {
  primaryBackground: "#07090f",
  secondaryBackground: "#0d111a",
  cardBackground: "#121722",
  borderColor: "#252c38",
  textColor: "#f4f7fb",
  mutedTextColor: "#9aa5b5",
  linkColor: "#3a8dde",
  scarletAccent: "#ef4056",
  azureAccent: "#3a8dde",
  amberAccent: "#e9a23b",
  adminColor: "#ef4056",
  editorColor: "#3a8dde",
  moderatorColor: "#e9a23b",
  supporterColor: "#a873e8",
  userColor: "#8c98a8",
  borderRadius: 14,
  shadowIntensity: 24,
  headingFont: "Arial, Helvetica, sans-serif",
  bodyFont: "Arial, Helvetica, sans-serif",
};

export async function getSitePresentation() {
  if (!process.env.DATABASE_URL) {
    return { site: null, theme: fallbackTheme };
  }

  try {
    const [site, theme] = await Promise.all([
      db.siteSetting.findUnique({ where: { id: "default" } }),
      db.themeSetting.findUnique({ where: { id: "default" } }),
    ]);
    return { site, theme: theme ?? fallbackTheme };
  } catch {
    return { site: null, theme: fallbackTheme };
  }
}

export function themeStyle(theme: typeof fallbackTheme): CSSProperties {
  return {
    "--color-bg": theme.primaryBackground,
    "--color-bg-secondary": theme.secondaryBackground,
    "--color-card": theme.cardBackground,
    "--color-border": theme.borderColor,
    "--color-text": theme.textColor,
    "--color-muted": theme.mutedTextColor,
    "--color-link": theme.linkColor,
    "--color-scarlet": theme.scarletAccent,
    "--color-azure": theme.azureAccent,
    "--color-amber": theme.amberAccent,
    "--role-admin": theme.adminColor,
    "--role-editor": theme.editorColor,
    "--role-moderator": theme.moderatorColor,
    "--role-supporter": theme.supporterColor,
    "--role-user": theme.userColor,
    "--radius-card": `${theme.borderRadius}px`,
    "--shadow-strength": `${theme.shadowIntensity / 100}`,
    "--font-heading": theme.headingFont,
    "--font-body": theme.bodyFont,
  } as CSSProperties;
}
