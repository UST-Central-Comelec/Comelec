import "server-only";
import type { Email } from "@/lib/email/send";
import { button, escape, paragraph, shell, siteUrl } from "@/lib/email/template";
import { fillTags, type Acknowledgement } from "./form-editor";
import type { CommissionEvent } from "./options";
import { rsvpAcknowledgement } from "./rsvp";

/**
 * The email an RSVP or Evaluation form sends once answers are saved: the organizer's Acknowledgement
 * subject and message, with {name}, {event} and {link} filled in.
 */
export function acknowledgementEmail(to: string, acknowledgement: Acknowledgement, event: Pick<CommissionEvent, "id" | "name">, name: string, eyebrow: string, referenceCode?: string, response: Array<[string, string]> = []): Email {
  const link = `${siteUrl()}/events/${event.id}/register`;
  const fill = (text: string) => fillTags(text, { name, event: event.name, link });
  const paragraphs = fill(acknowledgement.body).split(/\n{2,}/).map(text => text.trim()).filter(Boolean);
  const subject = fill(acknowledgement.subject);
  const trackingUrl = referenceCode ? `${siteUrl()}/apply/track?ref=${encodeURIComponent(referenceCode)}` : undefined;
  const referenceNote = referenceCode ? `RSVP reference: ${referenceCode}. Track your RSVP using this code and your student number or last name.` : undefined;
  const responseText = response.length ? ["Your response", ...response.map(([label, value]) => `${label}: ${value}`)] : [];
  const responseBlocks = response.length ? [paragraph("<strong>Your response</strong>"), ...response.map(([label, value]) => paragraph(`<strong>${escape(label)}</strong><br>${escape(value).replaceAll("\n", "<br>")}`))] : [];
  return {
    to,
    subject,
    text: [...paragraphs, ...responseText, ...(referenceNote ? [referenceNote, `Track RSVP: ${trackingUrl}`] : []), ...(acknowledgement.link ? [link] : [])].join("\n\n"),
    html: shell({ eyebrow, title: fill(acknowledgement.title), preheader: subject, blocks: [...(referenceNote ? [paragraph(escape(referenceNote)), button("Track RSVP", trackingUrl!)] : []), ...paragraphs.map(text => paragraph(escape(text).replaceAll("\n", "<br>"))), ...responseBlocks, ...(acknowledgement.link ? [button("Public registration form", link)] : [])] }),
  };
}

/** The RSVP's default acknowledgement, as the Email Sender's sample shows it. */
export const rsvpReceiptEmail = (person: { email: string; firstName: string }, event: Pick<CommissionEvent, "id" | "name">) => acknowledgementEmail(person.email, rsvpAcknowledgement, event, person.firstName, "Collaborator RSVP");
