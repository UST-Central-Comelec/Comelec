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
export function acknowledgementEmail(to: string, acknowledgement: Acknowledgement, event: Pick<CommissionEvent, "id" | "name">, name: string, eyebrow: string): Email {
  const link = `${siteUrl()}/events/${event.id}/register`;
  const fill = (text: string) => fillTags(text, { name, event: event.name, link });
  const paragraphs = fill(acknowledgement.body).split(/\n{2,}/).map(text => text.trim()).filter(Boolean);
  const subject = fill(acknowledgement.subject);
  return {
    to,
    subject,
    text: `${paragraphs.join("\n\n")}${acknowledgement.link ? `\n\n${link}` : ""}`,
    html: shell({ eyebrow, title: fill(acknowledgement.title), preheader: subject, blocks: [...paragraphs.map(text => paragraph(escape(text).replaceAll("\n", "<br>"))), ...(acknowledgement.link ? [button("Public registration form", link)] : [])] }),
  };
}

/** The RSVP's default acknowledgement, as the Email Sender's sample shows it. */
export const rsvpReceiptEmail = (person: { email: string; firstName: string }, event: Pick<CommissionEvent, "id" | "name">) => acknowledgementEmail(person.email, rsvpAcknowledgement, event, person.firstName, "Collaborator RSVP");
