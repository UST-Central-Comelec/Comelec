import "server-only";

import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { LOGO_CID, LOGO_PATH } from "./template";
import { getGmailSocket } from "./smtp-socket";

// Sends email through Gmail with an app password (SMTP_USER / SMTP_PASSWORD in .env.local).
// Everything that sends mail treats a failure as non-fatal: the caller logs it and carries on.

let transporter: Transporter | null = null;

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASSWORD?.trim());
}

function getTransporter() {
  transporter ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    getSocket: getGmailSocket,
    // One connection kept open and reused, so a batch from the Email Sender doesn't sign in again for every recipient.
    pool: true,
    maxConnections: 2,
    auth: {
      user: process.env.SMTP_USER!.trim(),
      // Google shows app passwords in groups of four; the spaces aren't part of it.
      pass: process.env.SMTP_PASSWORD!.replace(/\s/g, ""),
    },
  });
  return transporter;
}

/** `replyTo` is where a reply goes when it isn't the commission's own mailbox: the commissioner who wrote the email. */
export type Email = { to: string; subject: string; text: string; html: string; replyTo?: { name: string; address: string } };

/** The commission's seal, sent inside the email for the template's header (src/lib/email/template.ts). */
const seal = () => ({ filename: "ust-central-comelec.png", path: path.join(process.cwd(), "public", LOGO_PATH), cid: LOGO_CID });

/** Sends one email. Returns false (and logs why) instead of throwing. */
export async function sendEmail(email: Email) {
  if (!isEmailConfigured()) {
    console.warn(`Email not sent (“${email.subject}”): SMTP_USER and SMTP_PASSWORD aren’t set.`);
    return false;
  }
  const name = process.env.EMAIL_FROM_NAME?.trim() || "UST Central Comelec";
  try {
    await getTransporter().sendMail({ from: { name, address: process.env.SMTP_USER!.trim() }, ...email, attachments: email.html.includes(`cid:${LOGO_CID}`) ? [seal()] : [] });
    return true;
  } catch (error) {
    console.error(`Email not sent (“${email.subject}”):`, error instanceof Error ? error.message : error);
    return false;
  }
}
