import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

// Sends email through Gmail with an app password (SMTP_USER / SMTP_PASSWORD in .env.local).
// Everything that sends mail treats a failure as non-fatal: the caller logs it and carries on.

let transporter: Transporter | null = null;

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASSWORD?.trim());
}

function getTransporter() {
  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER!.trim(),
      // Google shows app passwords in groups of four; the spaces aren't part of it.
      pass: process.env.SMTP_PASSWORD!.replace(/\s/g, ""),
    },
  });
  return transporter;
}

export type Email = { to: string; subject: string; text: string; html: string };

/** Sends one email. Returns false (and logs why) instead of throwing. */
export async function sendEmail(email: Email) {
  if (!isEmailConfigured()) {
    console.warn(`Email not sent (“${email.subject}”): SMTP_USER and SMTP_PASSWORD aren’t set.`);
    return false;
  }
  const name = process.env.EMAIL_FROM_NAME?.trim() || "UST Central Comelec";
  try {
    await getTransporter().sendMail({ from: { name, address: process.env.SMTP_USER!.trim() }, ...email });
    return true;
  } catch (error) {
    console.error(`Email not sent (“${email.subject}”):`, error instanceof Error ? error.message : error);
    return false;
  }
}
