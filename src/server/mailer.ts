import nodemailer from "nodemailer";
import { getServerEnv } from "@/lib/env";
import { db } from "@/server/db";

type MailMessage = { to: string; subject: string; text: string; html: string };

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );

export async function sendMail(message: MailMessage): Promise<void> {
  const env = getServerEnv();
  if (!env.SMTP_HOST || !env.SMTP_FROM) {
    if (env.NODE_ENV === "production")
      throw new Error(
        "Production ortamında SMTP_HOST ve SMTP_FROM yapılandırması zorunludur.",
      );
    console.info("[development-mail]", {
      to: message.to,
      subject: message.subject,
    });
    return;
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
      : undefined,
  });
  await transport.sendMail({ ...message, from: env.SMTP_FROM });
}

export async function sendActionEmail(input: {
  to: string;
  title: string;
  message: string;
  actionUrl: string;
  actionLabel: string;
}): Promise<void> {
  const settings = await db.siteSetting.findUnique({
    where: { id: "default" },
  });
  const brand = settings?.brandName ?? getServerEnv().APP_NAME;
  const escapedUrl = escapeHtml(input.actionUrl);
  const escapedBrand = escapeHtml(brand);
  const escapedMessage = escapeHtml(input.message);
  const escapedLabel = escapeHtml(input.actionLabel);
  await sendMail({
    to: input.to,
    subject: `${input.title} | ${brand}`,
    text: `${input.message}\n\n${input.actionLabel}: ${input.actionUrl}\n\nBu bağlantıyı siz istemediyseniz bu mesajı yok sayın.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h1>${escapedBrand}</h1><p>${escapedMessage}</p><p><a href="${escapedUrl}">${escapedLabel}</a></p><p>Bu bağlantıyı siz istemediyseniz bu mesajı yok sayın.</p></div>`,
  });
}
